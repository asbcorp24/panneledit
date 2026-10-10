package ru.asbcorp.xrealstereo;

public final class NativeV4L2 {
    static {
        System.loadLibrary("xrealstereo");
    }

    public static native String probeJson();
    public static native byte[] captureFrame(String device, int width, int height, int fourcc);
    public static native String probeNrApi(boolean tryCreate);

    private NativeV4L2() {}
}
