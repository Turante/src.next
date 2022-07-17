// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "third_party/blink/renderer/platform/graphics/web_graphics_context_3d_video_frame_pool.h"

#include "components/viz/common/gpu/raster_context_provider.h"
#include "gpu/command_buffer/client/context_support.h"
#include "gpu/command_buffer/client/gpu_memory_buffer_manager.h"
#include "gpu/command_buffer/client/shared_image_interface.h"
#include "media/base/video_frame.h"
#include "media/renderers/video_frame_rgba_to_yuva_converter.h"
#include "media/video/gpu_video_accelerator_factories.h"
#include "media/video/renderable_gpu_memory_buffer_video_frame_pool.h"
#include "third_party/blink/public/platform/platform.h"
#include "third_party/blink/renderer/platform/graphics/web_graphics_context_3d_provider_wrapper.h"
#include "third_party/blink/renderer/platform/wtf/functional.h"

namespace blink {

namespace {

class Context : public media::RenderableGpuMemoryBufferVideoFramePool::Context {
 public:
  explicit Context(base::WeakPtr<blink::WebGraphicsContext3DProviderWrapper>
                       context_provider,
                   gpu::GpuMemoryBufferManager* gmb_manager)
      : weak_context_provider_(context_provider), gmb_manager_(gmb_manager) {}

  std::unique_ptr<gfx::GpuMemoryBuffer> CreateGpuMemoryBuffer(
      const gfx::Size& size,
      gfx::BufferFormat format,
      gfx::BufferUsage usage) override {
    return gmb_manager_
               ? gmb_manager_->CreateGpuMemoryBuffer(
                     size, format, usage, gpu::kNullSurfaceHandle, nullptr)
               : nullptr;
  }

  void CreateSharedImage(gfx::GpuMemoryBuffer* gpu_memory_buffer,
                         gfx::BufferPlane plane,
                         const gfx::ColorSpace& color_space,
                         GrSurfaceOrigin surface_origin,
                         SkAlphaType alpha_type,
                         uint32_t usage,
                         gpu::Mailbox& mailbox,
                         gpu::SyncToken& sync_token) override {
    auto* sii = SharedImageInterface();
    if (!sii || !gmb_manager_)
      return;
    mailbox =
        sii->CreateSharedImage(gpu_memory_buffer, gmb_manager_, plane,
                               color_space, surface_origin, alpha_type, usage);
    sync_token = sii->GenVerifiedSyncToken();
  }

  void DestroySharedImage(const gpu::SyncToken& sync_token,
                          const gpu::Mailbox& mailbox) override {
    auto* sii = SharedImageInterface();
    if (!sii)
      return;
    sii->DestroySharedImage(sync_token, mailbox);
  }

 private:
  gpu::SharedImageInterface* SharedImageInterface() const {
    if (!weak_context_provider_)
      return nullptr;
    auto* context_provider = weak_context_provider_->ContextProvider();
    if (!context_provider)
      return nullptr;
    return context_provider->SharedImageInterface();
  }

  base::WeakPtr<blink::WebGraphicsContext3DProviderWrapper>
      weak_context_provider_;
  gpu::GpuMemoryBufferManager* gmb_manager_;
};

}  // namespace

WebGraphicsContext3DVideoFramePool::WebGraphicsContext3DVideoFramePool(
    base::WeakPtr<blink::WebGraphicsContext3DProviderWrapper>
        weak_context_provider)
    : WebGraphicsContext3DVideoFramePool(
          std::move(weak_context_provider),
          Platform::Current()->GetGpuMemoryBufferManager()) {}

WebGraphicsContext3DVideoFramePool::WebGraphicsContext3DVideoFramePool(
    base::WeakPtr<blink::WebGraphicsContext3DProviderWrapper>
        weak_context_provider,
    gpu::GpuMemoryBufferManager* gmb_manager)
    : weak_context_provider_(weak_context_provider),
      pool_(media::RenderableGpuMemoryBufferVideoFramePool::Create(
          std::make_unique<Context>(weak_context_provider, gmb_manager))) {}

WebGraphicsContext3DVideoFramePool::~WebGraphicsContext3DVideoFramePool() =
    default;

gpu::raster::RasterInterface*
WebGraphicsContext3DVideoFramePool::GetRasterInterface() const {
  if (weak_context_provider_) {
    if (auto* context_provider = weak_context_provider_->ContextProvider()) {
      if (auto* raster_context_provider =
              context_provider->RasterContextProvider()) {
        return raster_context_provider->RasterInterface();
      }
    }
  }
  return nullptr;
}

bool WebGraphicsContext3DVideoFramePool::CopyRGBATextureToVideoFrame(
    viz::ResourceFormat src_format,
    const gfx::Size& src_size,
    const gfx::ColorSpace& src_color_space,
    GrSurfaceOrigin src_surface_origin,
    const gpu::MailboxHolder& src_mailbox_holder,
    const gfx::ColorSpace& dst_color_space,
    FrameReadyCallback callback) {
  // Issue `callback` with a nullptr VideoFrame if we return early.
  base::ScopedClosureRunner failure_runner(WTF::Bind(
      [](FrameReadyCallback* callback) { std::move(*callback).Run(nullptr); },
      base::Unretained(&callback)));

  if (!weak_context_provider_)
    return false;
  auto* context_provider = weak_context_provider_->ContextProvider();
  if (!context_provider)
    return false;
  auto* raster_context_provider = context_provider->RasterContextProvider();
  if (!raster_context_provider)
    return false;

#if BUILDFLAG(IS_WIN)
  // CopyRGBATextureToVideoFrame below needs D3D shared images on Windows so
  // early out before creating the GMB since it's going to fail anyway.
  if (!context_provider->GetCapabilities().shared_image_d3d)
    return false;
#endif  // BUILDFLAG(IS_WIN)

  scoped_refptr<media::VideoFrame> dst_frame =
      pool_->MaybeCreateVideoFrame(src_size, dst_color_space);
  if (!dst_frame)
    return false;

  gpu::SyncToken copy_done_sync_token;
  const bool copy_succeeded = media::CopyRGBATextureToVideoFrame(
      raster_context_provider, src_format, src_size, src_color_space,
      src_surface_origin, src_mailbox_holder, dst_frame.get(),
      copy_done_sync_token);
  if (!copy_succeeded)
    return false;

  IgnoreResult(failure_runner.Release());
  raster_context_provider->ContextSupport()->SignalSyncToken(
      copy_done_sync_token, base::BindOnce(std::move(callback), dst_frame));
  return true;
}

namespace {

void ApplyMetadataAndRunCallback(
    scoped_refptr<media::VideoFrame> src_video_frame,
    WebGraphicsContext3DVideoFramePool::FrameReadyCallback orig_callback,
    scoped_refptr<media::VideoFrame> converted_video_frame) {
  if (!converted_video_frame) {
    std::move(orig_callback).Run(nullptr);
    return;
  }
  // TODO(https://crbug.com/1302284): handle cropping before conversion
  auto wrapped_format = converted_video_frame->format();
  auto wrapped = media::VideoFrame::WrapVideoFrame(
      std::move(converted_video_frame), wrapped_format,
      src_video_frame->visible_rect(), src_video_frame->natural_size());
  wrapped->set_timestamp(src_video_frame->timestamp());
  // TODO(https://crbug.com/1302283): old metadata might not be applicable to
  // new frame
  wrapped->metadata().MergeMetadataFrom(src_video_frame->metadata());

  std::move(orig_callback).Run(std::move(wrapped));
}

}  // namespace

bool WebGraphicsContext3DVideoFramePool::ConvertVideoFrame(
    scoped_refptr<media::VideoFrame> src_video_frame,
    const gfx::ColorSpace& dst_color_space,
    FrameReadyCallback callback) {
  auto format = src_video_frame->format();
  DCHECK(format == media::PIXEL_FORMAT_XBGR ||
         format == media::PIXEL_FORMAT_ABGR ||
         format == media::PIXEL_FORMAT_XRGB ||
         format == media::PIXEL_FORMAT_ARGB)
      << "Invalid format " << format;
  DCHECK_EQ(src_video_frame->NumTextures(), std::size_t{1});
  viz::ResourceFormat texture_format;
  switch (format) {
    case media::PIXEL_FORMAT_XBGR:
      texture_format = viz::RGBX_8888;
      break;
    case media::PIXEL_FORMAT_ABGR:
      texture_format = viz::RGBA_8888;
      break;
    case media::PIXEL_FORMAT_XRGB:
      texture_format = viz::BGRX_8888;
      break;
    case media::PIXEL_FORMAT_ARGB:
      texture_format = viz::BGRA_8888;
      break;
    default:
      NOTREACHED();
      return false;
  }

  return CopyRGBATextureToVideoFrame(
      texture_format, src_video_frame->coded_size(),
      src_video_frame->ColorSpace(),
      src_video_frame->metadata().texture_origin_is_top_left
          ? kTopLeft_GrSurfaceOrigin
          : kBottomLeft_GrSurfaceOrigin,
      src_video_frame->mailbox_holder(0), dst_color_space,
      WTF::Bind(ApplyMetadataAndRunCallback, src_video_frame,
                std::move(callback)));
}

}  // namespace blink
