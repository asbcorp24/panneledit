package ru.asbcorp.xrealstereo;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.SurfaceTexture;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.camera2.*;
import android.hardware.camera2.params.OutputConfiguration;
import android.hardware.camera2.params.SessionConfiguration;
import android.media.Image;
import android.media.ImageReader;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.util.Size;
import android.view.Gravity;
import android.view.Surface;
import android.view.TextureView;
import android.widget.*;

import java.io.*;
import java.nio.ByteBuffer;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.Executor;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class MainActivity extends Activity implements SensorEventListener {
    private static final int REQ_CAMERA = 10;
    private final int[] sectorOptions = {12, 18, 24, 36};

    private TextureView preview;
    private TextView status, angleText, progressText, pairText;
    private ProgressBar progress;
    private Button shootBtn;
    private CameraManager cameraManager;
    private CameraDevice cameraDevice;
    private CameraCaptureSession captureSession;
    private ImageReader leftReader, rightReader;
    private HandlerThread cameraThread;
    private Handler cameraHandler;
    private String logicalCameraId, leftPhysicalId, rightPhysicalId;
    private Size captureSize;
    private boolean stereoReady = false, openingCamera = false;

    private SensorManager sensorManager;
    private Sensor rotationSensor;
    private float yawDeg = 0f, pitchDeg = 0f, rollDeg = 0f;
    private Float zeroYaw = null;
    private int sectors = 24, step = 0;
    private boolean captureBusy = false, leftSaved = false, rightSaved = false;
    private File sessionDir;
    private final List<ShotMeta> shots = new ArrayList<>();
    private final Executor directExecutor = Runnable::run;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        buildUi();
        cameraManager = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xff111318);
        root.setPadding(dp(12), dp(10), dp(12), dp(10));

        TextView title = tv("XREAL Stereo Panorama", 22, true);
        root.addView(title, lp(-1, dp(42)));
        pairText = tv("Поиск стереокамер…", 13, false);
        pairText.setTextColor(0xff9fb2c8);
        root.addView(pairText, lp(-1, dp(38)));

        FrameLayout frame = new FrameLayout(this);
        preview = new TextureView(this);
        frame.addView(preview, new FrameLayout.LayoutParams(-1, -1));
        TextView cross = tv("＋", 52, false);
        cross.setGravity(Gravity.CENTER);
        cross.setTextColor(0x88ffffff);
        frame.addView(cross, new FrameLayout.LayoutParams(-1, -1));
        angleText = tv("0.0°  →  цель 0.0°", 18, true);
        angleText.setGravity(Gravity.CENTER);
        angleText.setBackgroundColor(0x88000000);
        frame.addView(angleText, new FrameLayout.LayoutParams(-1, dp(48), Gravity.BOTTOM));
        root.addView(frame, new LinearLayout.LayoutParams(-1, 0, 1f));

        progressText = tv("Кадр 0 / 24", 15, true);
        root.addView(progressText, lp(-1, dp(34)));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(sectors);
        root.addView(progress, lp(-1, dp(10)));
        status = tv("Поверните устройство к первой точке и нажмите СТАРТ", 14, false);
        status.setGravity(Gravity.CENTER);
        root.addView(status, lp(-1, dp(48)));

        shootBtn = button("СТАРТ / СНИМОК");
        shootBtn.setOnClickListener(v -> onShoot());
        root.addView(shootBtn, lp(-1, dp(58)));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        Button reset = button("Сброс"), settings = button("Настройки"), export = button("Экспорт"), diag = button("Камеры");
        reset.setOnClickListener(v -> resetSession());
        settings.setOnClickListener(v -> chooseSettings());
        export.setOnClickListener(v -> exportSession());
        diag.setOnClickListener(v -> showDiagnostics());
        for (Button x : new Button[]{reset, settings, export, diag})
            row.addView(x, new LinearLayout.LayoutParams(0, dp(52), 1f));
        root.addView(row);
        setContentView(root);

        preview.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            public void onSurfaceTextureAvailable(SurfaceTexture s, int w, int h) { startCamera(); }
            public void onSurfaceTextureSizeChanged(SurfaceTexture s, int w, int h) {}
            public boolean onSurfaceTextureDestroyed(SurfaceTexture s) { return true; }
            public void onSurfaceTextureUpdated(SurfaceTexture s) {}
        });
    }

    private TextView tv(String text, int sp, boolean bold) {
        TextView v = new TextView(this);
        v.setText(text); v.setTextSize(sp); v.setTextColor(0xfff4f7fb);
        if (bold) v.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        return v;
    }
    private Button button(String t) { Button b = new Button(this); b.setText(t); return b; }
    private LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w,h); }
    private int dp(int v) { return (int)(v * getResources().getDisplayMetrics().density + .5f); }

    @Override protected void onResume() {
        super.onResume();
        cameraThread = new HandlerThread("XREALCamera");
        cameraThread.start();
        cameraHandler = new Handler(cameraThread.getLooper());
        if (rotationSensor != null) sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_GAME);
        if (preview != null && preview.isAvailable() && checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)
            startCamera();
    }

    @Override protected void onPause() {
        closeCamera();
        sensorManager.unregisterListener(this);
        if (cameraThread != null) {
            cameraThread.quitSafely();
            try { cameraThread.join(); } catch (InterruptedException ignored) {}
        }
        cameraThread = null; cameraHandler = null;
        super.onPause();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_CAMERA && results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED) startCamera();
        else status.setText("Нужен доступ к камере");
    }

    private void startCamera() {
        if (!preview.isAvailable() || openingCamera || cameraDevice != null || cameraHandler == null) return;
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) return;
        try {
            StereoPair p = findStereoPair();
            if (p == null) {
                pairText.setText("Стереопара Camera2 не найдена — откройте «Камеры»");
                status.setText("Beam Pro не опубликовал logical multi-camera пару через Camera2");
                return;
            }
            logicalCameraId=p.logical; leftPhysicalId=p.left; rightPhysicalId=p.right; captureSize=p.size;
            pairText.setText("Logical "+logicalCameraId+" | L="+leftPhysicalId+" R="+rightPhysicalId+" | "+captureSize.getWidth()+"×"+captureSize.getHeight());
            openingCamera=true;
            cameraManager.openCamera(logicalCameraId, new CameraDevice.StateCallback() {
                @Override public void onOpened(CameraDevice c) { openingCamera=false; cameraDevice=c; createSession(); }
                @Override public void onDisconnected(CameraDevice c) { openingCamera=false; c.close(); cameraDevice=null; }
                @Override public void onError(CameraDevice c, int e) { openingCamera=false; c.close(); cameraDevice=null; runOnUiThread(() -> status.setText("Ошибка камеры: "+e)); }
            }, cameraHandler);
        } catch (Exception e) {
            openingCamera=false;
            status.setText("Camera2: "+e.getMessage());
        }
    }

    private StereoPair findStereoPair() throws CameraAccessException {
        StereoPair best=null;
        for (String id:cameraManager.getCameraIdList()) {
            CameraCharacteristics ch=cameraManager.getCameraCharacteristics(id);
            Integer facing=ch.get(CameraCharacteristics.LENS_FACING);
            Set<String> phys=ch.getPhysicalCameraIds();
            int[] caps=ch.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES);
            boolean logical=hasCap(caps, CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA);
            if (!logical || phys.size()<2 || (facing!=null && facing!=CameraCharacteristics.LENS_FACING_BACK)) continue;
            List<String> ids=new ArrayList<>(phys);
            for(int i=0;i<ids.size();i++) for(int j=i+1;j<ids.size();j++) {
                Size s=commonJpegSize(ids.get(i),ids.get(j));
                if(s!=null && (best==null || area(s)>area(best.size))) best=new StereoPair(id,ids.get(i),ids.get(j),s);
            }
        }
        return best;
    }

    private Size commonJpegSize(String a,String b) throws CameraAccessException {
        android.hardware.camera2.params.StreamConfigurationMap ma=cameraManager.getCameraCharacteristics(a).get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
        android.hardware.camera2.params.StreamConfigurationMap mb=cameraManager.getCameraCharacteristics(b).get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
        if(ma==null||mb==null)return null;
        Size[] aa=ma.getOutputSizes(android.graphics.ImageFormat.JPEG), bb=mb.getOutputSizes(android.graphics.ImageFormat.JPEG);
        Set<String> sb=new HashSet<>(); for(Size s:bb)sb.add(s.getWidth()+"x"+s.getHeight());
        Size best=null;
        for(Size s:aa) {
            if(!sb.contains(s.getWidth()+"x"+s.getHeight()))continue;
            if(s.getWidth()>5000||s.getHeight()>4000)continue;
            if(best==null||area(s)>area(best))best=s;
        }
        if(best==null)for(Size s:aa)if(sb.contains(s.getWidth()+"x"+s.getHeight())&&(best==null||area(s)>area(best)))best=s;
        return best;
    }
    private long area(Size s){return(long)s.getWidth()*s.getHeight();}

    private void createSession() {
        try {
            leftReader=ImageReader.newInstance(captureSize.getWidth(),captureSize.getHeight(),android.graphics.ImageFormat.JPEG,2);
            rightReader=ImageReader.newInstance(captureSize.getWidth(),captureSize.getHeight(),android.graphics.ImageFormat.JPEG,2);
            leftReader.setOnImageAvailableListener(r->saveImage(r,true),cameraHandler);
            rightReader.setOnImageAvailableListener(r->saveImage(r,false),cameraHandler);
            SurfaceTexture tex=preview.getSurfaceTexture(); tex.setDefaultBufferSize(1280,720);
            Surface previewSurface=new Surface(tex);
            OutputConfiguration op=new OutputConfiguration(previewSurface);
            OutputConfiguration ol=new OutputConfiguration(leftReader.getSurface()); ol.setPhysicalCameraId(leftPhysicalId);
            OutputConfiguration or=new OutputConfiguration(rightReader.getSurface()); or.setPhysicalCameraId(rightPhysicalId);
            SessionConfiguration sc=new SessionConfiguration(SessionConfiguration.SESSION_REGULAR,Arrays.asList(op,ol,or),directExecutor,new CameraCaptureSession.StateCallback(){
                @Override public void onConfigured(CameraCaptureSession s){
                    captureSession=s;
                    try{
                        CaptureRequest.Builder b=cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                        b.addTarget(previewSurface);
                        b.set(CaptureRequest.CONTROL_AF_MODE,CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
                        s.setRepeatingRequest(b.build(),null,cameraHandler);
                        stereoReady=true;
                        runOnUiThread(()->status.setText("Стереокамеры готовы. Наведите на начало круга."));
                    }catch(Exception e){runOnUiThread(()->status.setText("Preview: "+e.getMessage()));}
                }
                @Override public void onConfigureFailed(CameraCaptureSession s){stereoReady=false;runOnUiThread(()->status.setText("Beam Pro отклонил одновременный поток двух physical cameras"));}
            });
            cameraDevice.createCaptureSession(sc);
        } catch(Exception e){status.setText("Стереосессия: "+e.getMessage());}
    }

    private void onShoot() {
        if(!stereoReady){status.setText("Стереокамеры ещё не готовы");return;}
        if(captureBusy)return;
        if(step>=sectors){status.setText("Круг завершён. Нажмите ЭКСПОРТ или СБРОС.");return;}
        if(zeroYaw==null){zeroYaw=yawDeg;createNewSession();}
        float err=shortest(targetAngle()-relativeYaw());
        if(step>0 && Math.abs(err)>Math.max(5f,180f/sectors)){status.setText(String.format(Locale.US,"Доверните к цели: ошибка %.1f°",err));return;}
        if(Math.abs(pitchDeg)>18f||Math.abs(rollDeg)>18f){status.setText(String.format(Locale.US,"Выровняйте Beam Pro: %.1f° / %.1f°",pitchDeg,rollDeg));return;}
        captureStereo();
    }

    private void captureStereo() {
        try {
            captureBusy=true;leftSaved=false;rightSaved=false;
            int shotIndex=step; float rel=relativeYaw();
            CaptureRequest.Builder b=cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE);
            b.addTarget(leftReader.getSurface());b.addTarget(rightReader.getSurface());
            b.set(CaptureRequest.CONTROL_AF_MODE,CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
            b.setTag(shotIndex);
            captureSession.capture(b.build(),new CameraCaptureSession.CaptureCallback(){
                @Override public void onCaptureFailed(CameraCaptureSession session,CaptureRequest request,CaptureFailure failure){
                    captureBusy=false;runOnUiThread(()->status.setText("Ошибка стереоснимка: "+failure.getReason()));
                }
            },cameraHandler);
            shots.add(new ShotMeta(shotIndex,rel,yawDeg,pitchDeg,rollDeg,System.currentTimeMillis()));
            runOnUiThread(()->status.setText("Снимаю L+R…"));
        }catch(Exception e){captureBusy=false;status.setText("Capture: "+e.getMessage());}
    }

    private void saveImage(ImageReader reader,boolean left) {
        Image image=null;
        try{
            image=reader.acquireNextImage();if(image==null||sessionDir==null)return;
            ByteBuffer buf=image.getPlanes()[0].getBuffer();byte[] data=new byte[buf.remaining()];buf.get(data);
            int idx=step;
            File f=new File(sessionDir,String.format(Locale.US,"%s_%03d.jpg",left?"left":"right",idx));
            try(FileOutputStream out=new FileOutputStream(f)){out.write(data);}
            if(left)leftSaved=true;else rightSaved=true;
            if(leftSaved&&rightSaved){
                writeManifest();step++;captureBusy=false;
                runOnUiThread(()->{updateProgress();if(step>=sectors)status.setText("Готово: полный круг отснят. Нажмите ЭКСПОРТ.");else status.setText("Пара сохранена. Поверните к следующей метке.");});
            }
        }catch(Exception e){captureBusy=false;runOnUiThread(()->status.setText("Сохранение: "+e.getMessage()));}
        finally{if(image!=null)image.close();}
    }

    private void createNewSession() {
        String stamp=new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.US).format(new Date());
        sessionDir=new File(getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES),"XREAL_StereoPanorama/"+stamp);
        sessionDir.mkdirs();shots.clear();step=0;writeManifest();updateProgress();
    }

    private void writeManifest() {
        if(sessionDir==null)return;
        File f=new File(sessionDir,"session.json");
        try(PrintWriter w=new PrintWriter(new OutputStreamWriter(new FileOutputStream(f),"UTF-8"))){
            w.println("{");
            w.println("  \"format\": \"xreal-stereo-panorama-1\",");
            w.println("  \"logicalCameraId\": \""+safe(logicalCameraId)+"\",");
            w.println("  \"leftPhysicalCameraId\": \""+safe(leftPhysicalId)+"\",");
            w.println("  \"rightPhysicalCameraId\": \""+safe(rightPhysicalId)+"\",");
            w.println("  \"width\": "+(captureSize==null?0:captureSize.getWidth())+",");
            w.println("  \"height\": "+(captureSize==null?0:captureSize.getHeight())+",");
            w.println("  \"sectors\": "+sectors+",");
            w.println("  \"shots\": [");
            for(int i=0;i<shots.size();i++){
                ShotMeta s=shots.get(i);
                w.print(String.format(Locale.US,"    {\"index\":%d,\"relativeYaw\":%.3f,\"yaw\":%.3f,\"pitch\":%.3f,\"roll\":%.3f,\"timeMs\":%d,\"left\":\"left_%03d.jpg\",\"right\":\"right_%03d.jpg\"}",s.index,s.relativeYaw,s.yaw,s.pitch,s.roll,s.timeMs,s.index,s.index));
                w.println(i+1<shots.size()?",":"");
            }
            w.println("  ]");w.println("}");
        }catch(Exception ignored){}
    }
    private String safe(String s){return s==null?"":s.replace("\\","\\\\").replace("\"","\\\"");}

    private void resetSession(){zeroYaw=null;step=0;shots.clear();sessionDir=null;updateProgress();status.setText("Сброшено. Наведите на начало и нажмите СТАРТ / СНИМОК");}

    private void chooseSettings(){
        String[] items={"12 кадров (30°)","18 кадров (20°)","24 кадра (15°)","36 кадров (10°)"};
        int current=2;for(int i=0;i<sectorOptions.length;i++)if(sectorOptions[i]==sectors)current=i;
        new AlertDialog.Builder(this).setTitle("Количество позиций на 360°").setSingleChoiceItems(items,current,(d,which)->{sectors=sectorOptions[which];resetSession();d.dismiss();}).setNegativeButton("Отмена",null).show();
    }

    private void exportSession(){
        if(sessionDir==null||step==0){status.setText("Сначала сделайте хотя бы один стереоснимок");return;}
        writeManifest();
        String name="XREAL_StereoPanorama_"+sessionDir.getName()+".zip";
        try{
            ContentValues cv=new ContentValues();cv.put(MediaStore.Downloads.DISPLAY_NAME,name);cv.put(MediaStore.Downloads.MIME_TYPE,"application/zip");cv.put(MediaStore.Downloads.RELATIVE_PATH,"Download/XREAL_StereoPanorama");
            Uri u=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,cv);if(u==null)throw new IOException("MediaStore insert failed");
            try(OutputStream os=getContentResolver().openOutputStream(u);ZipOutputStream z=new ZipOutputStream(os)){
                File[] files=sessionDir.listFiles();if(files!=null)for(File f:files)if(f.isFile()){
                    z.putNextEntry(new ZipEntry(f.getName()));try(FileInputStream in=new FileInputStream(f)){byte[] buf=new byte[65536];int n;while((n=in.read(buf))>0)z.write(buf,0,n);}z.closeEntry();
                }
            }
            status.setText("Экспортировано: Download/XREAL_StereoPanorama/"+name);
        }catch(Exception e){status.setText("Экспорт: "+e.getMessage());}
    }

    private void showDiagnostics(){
        try{
            StringBuilder x=new StringBuilder();
            for(String id:cameraManager.getCameraIdList()){
                CameraCharacteristics c=cameraManager.getCameraCharacteristics(id);
                Integer facing=c.get(CameraCharacteristics.LENS_FACING);int[] caps=c.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES);
                x.append("Camera ").append(id).append("  facing=").append(facing).append("\n");
                x.append("physicalIds=").append(c.getPhysicalCameraIds()).append("\n");
                x.append("logicalMulti=").append(hasCap(caps,CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA)).append("\n");
                Integer sync=c.get(CameraCharacteristics.LOGICAL_MULTI_CAMERA_SENSOR_SYNC_TYPE);
                if(sync!=null)x.append("syncType=").append(sync==CameraCharacteristics.LOGICAL_MULTI_CAMERA_SENSOR_SYNC_TYPE_CALIBRATED?"CALIBRATED":"APPROXIMATE").append("\n");
                x.append("\n");
            }
            TextView t=tv(x.toString(),12,false);t.setTextColor(0xff111111);t.setPadding(dp(12),dp(12),dp(12),dp(12));ScrollView s=new ScrollView(this);s.addView(t);
            new AlertDialog.Builder(this).setTitle("Camera2 diagnostics").setView(s).setPositiveButton("OK",null).show();
        }catch(Exception e){status.setText("Диагностика: "+e.getMessage());}
    }
    private boolean hasCap(int[] a,int v){if(a!=null)for(int x:a)if(x==v)return true;return false;}

    private void closeCamera(){
        stereoReady=false;
        try{if(captureSession!=null)captureSession.close();}catch(Exception ignored){}captureSession=null;
        try{if(cameraDevice!=null)cameraDevice.close();}catch(Exception ignored){}cameraDevice=null;
        try{if(leftReader!=null)leftReader.close();}catch(Exception ignored){}leftReader=null;
        try{if(rightReader!=null)rightReader.close();}catch(Exception ignored){}rightReader=null;
        openingCamera=false;
    }

    @Override public void onSensorChanged(SensorEvent event){
        if(event.sensor.getType()!=Sensor.TYPE_ROTATION_VECTOR)return;
        float[] r=new float[9],o=new float[3];SensorManager.getRotationMatrixFromVector(r,event.values);SensorManager.getOrientation(r,o);
        yawDeg=(float)Math.toDegrees(o[0]);pitchDeg=(float)Math.toDegrees(o[1]);rollDeg=(float)Math.toDegrees(o[2]);runOnUiThread(this::updateAngles);
    }
    @Override public void onAccuracyChanged(Sensor sensor,int accuracy){}

    private float relativeYaw(){if(zeroYaw==null)return 0f;float d=yawDeg-zeroYaw;while(d<0)d+=360;while(d>=360)d-=360;return d;}
    private float targetAngle(){return step*(360f/sectors);}
    private float shortest(float v){while(v>180)v-=360;while(v<-180)v+=360;return v;}
    private void updateAngles(){
        float cur=relativeYaw(),target=targetAngle(),err=shortest(target-cur);
        angleText.setText(String.format(Locale.US,"%.1f°   →   цель %.1f°   Δ %.1f°",cur,target,err));
        angleText.setTextColor(Math.abs(err)<4?0xff67e480:0xfff4f7fb);
    }
    private void updateProgress(){progress.setMax(sectors);progress.setProgress(step);progressText.setText("Кадр "+step+" / "+sectors+"   •   шаг "+String.format(Locale.US,"%.1f°",360f/sectors));updateAngles();}

    private static class StereoPair{String logical,left,right;Size size;StereoPair(String l,String a,String b,Size s){logical=l;left=a;right=b;size=s;}}
    private static class ShotMeta{int index;float relativeYaw,yaw,pitch,roll;long timeMs;ShotMeta(int i,float r,float y,float p,float ro,long t){index=i;relativeYaw=r;yaw=y;pitch=p;roll=ro;timeMs=t;}}
}
