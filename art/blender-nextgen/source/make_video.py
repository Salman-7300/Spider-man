# Bildfolge (JPG) -> MP4 (H.264) ueber den Blender-Sequenzer. Per exec laden, dann make_video(...) aufrufen.
import bpy, os, glob

def make_video(frame_dir, out_path, fps=30, w=1280, h=720):
    files = sorted(glob.glob(os.path.join(frame_dir, "*.jpg")))
    sc = bpy.data.scenes.get("_video") or bpy.data.scenes.new("_video")
    if sc.sequence_editor:
        for s in list(sc.sequence_editor.strips):
            sc.sequence_editor.strips.remove(s)
    else:
        sc.sequence_editor_create()
    se = sc.sequence_editor
    strip = se.strips.new_image("frames", files[0], 1, 1)
    for f in files[1:]:
        strip.elements.append(os.path.basename(f))
    sc.frame_start = 1; sc.frame_end = len(files)
    sc.render.fps = fps
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.resolution_percentage = 100
    sc.render.image_settings.media_type = 'VIDEO'
    sc.render.image_settings.file_format = 'FFMPEG'
    sc.render.ffmpeg.format = 'MPEG4'
    sc.render.ffmpeg.codec = 'H264'
    sc.render.ffmpeg.constant_rate_factor = 'MEDIUM'
    sc.render.filepath = out_path
    sc.render.use_sequencer = True
    bpy.ops.render.render(animation=True, scene=sc.name)
    return {"frames": len(files), "bytes": os.path.getsize(out_path) if os.path.exists(out_path) else None}
