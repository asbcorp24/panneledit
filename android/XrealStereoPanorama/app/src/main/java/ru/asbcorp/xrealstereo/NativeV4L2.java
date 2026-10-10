package ru.asbcorp.xrealstereo;

public final class NativeV4L2 {
    static {
        System.loadLibrary("xrealstereo");
    }

    public static native String probeJson();
    public static native byte[] captureFrame(String device, int width, int height, int fourcc);

    private NativeV4L2() {}
}
