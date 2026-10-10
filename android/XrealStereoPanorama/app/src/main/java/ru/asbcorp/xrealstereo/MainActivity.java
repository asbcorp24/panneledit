package ru.asbcorp.xrealstereo;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.database.Cursor;
import android.hardware.*;
import android.hardware.camera2.*;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.view.*;
import android.widget.*;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;
import org.json.*;

public class MainActivity extends Activity implements SensorEventListener {
    private static final int REQ_CAMERA = 10;
    private final int[] sectorOptions = {12,18,24,36};

    private TextView status, angleText, progressText, cameraModeText;
    private ProgressBar progress;
    private Button captureButton;

    private SensorManager sensorManager;
    private Sensor rotationSensor;
    private float yawDeg=0,pitchDeg=0,rollDeg=0;
    private Float zeroYaw=null;

    private int sectors=24, step=0;
    private long launchTimeMs=0;
    private long lastAcceptedDateSec=0;
    private boolean waitingForSpatialPhoto=false;
    private File sessionDir;
    private final List<ShotMeta> shots=new ArrayList<>();

    private CameraManager cameraManager;

    @Override protected void onCreate(Bundle b){
        super.onCreate(b);
        buildUi();
        sensorManager=(SensorManager)getSystemService(Context.SENSOR_SERVICE);
        rotationSensor=sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        cameraManager=(CameraManager)getSystemService(Context.CAMERA_SERVICE);
        ArrayList<String> perms=new ArrayList<>();
        if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.CAMERA);
        if(Build.VERSION.SDK_INT>=33){
            if(checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES)!=PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.READ_MEDIA_IMAGES);
        }else{
            if(checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE)!=PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        if(!perms.isEmpty()) requestPermissions(perms.toArray(new String[0]),REQ_CAMERA);
    }

    private void buildUi(){
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(14),dp(10),dp(14),dp(10));
        root.setBackgroundColor(0xff111318);

        root.addView(tv("XREAL Stereo Panorama",22,true),lp(-1,dp(42)));
        cameraModeText=tv("Режим: штатная Spatial Camera XREAL",13,false);
        cameraModeText.setTextColor(0xff9fb2c8);
        root.addView(cameraModeText,lp(-1,dp(34)));

        FrameLayout compassBox=new FrameLayout(this);
        TextView circle=tv("◎",150,false);circle.setGravity(Gravity.CENTER);circle.setTextColor(0x44ffffff);
        compassBox.addView(circle,new FrameLayout.LayoutParams(-1,-1));
        angleText=tv("0.0°  →  цель 0.0°",22,true);angleText.setGravity(Gravity.CENTER);
        compassBox.addView(angleText,new FrameLayout.LayoutParams(-1,dp(64),Gravity.CENTER));
        root.addView(compassBox,new LinearLayout.LayoutParams(-1,0,1f));

        progressText=tv("Кадр 0 / 24",16,true);
        root.addView(progressText,lp(-1,dp(34)));
        progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        progress.setMax(sectors);
        root.addView(progress,lp(-1,dp(10)));

        status=tv("Выставьте Beam Pro на начало круга и нажмите «СНЯТЬ СТЕРЕОКАДР».",14,false);
        status.setGravity(Gravity.CENTER);
        root.addView(status,lp(-1,dp(70)));

        captureButton=button("СНЯТЬ СТЕРЕОКАДР");
        captureButton.setOnClickListener(v->openSpatialCamera());
        root.addView(captureButton,lp(-1,dp(60)));

        LinearLayout row=new LinearLayout(this);row.setOrientation(LinearLayout.HORIZONTAL);
        Button reset=button("Сброс"), settings=button("Настройки"), diag=button("Camera2"), v4l2=button("V4L2");
        reset.setOnClickListener(v->resetSession());
        settings.setOnClickListener(v->chooseSettings());
        diag.setOnClickListener(v->showDiagnostics());
        v4l2.setOnClickListener(v->showV4L2Diagnostics());
        for(Button b:new Button[]{reset,settings,diag,v4l2})row.addView(b,new LinearLayout.LayoutParams(0,dp(52),1f));
        root.addView(row);

        TextView hint=tv("Важно: при первом запуске штатной камеры выберите режим Spatial/3D. Beam Pro обычно запоминает последний выбранный режим.",12,false);
        hint.setTextColor(0xff9fb2c8);hint.setPadding(0,dp(8),0,0);
        root.addView(hint,lp(-1,dp(58)));

        setContentView(root);
    }

    private TextView tv(String text,int sp,boolean bold){
        TextView v=new TextView(this);v.setText(text);v.setTextSize(sp);v.setTextColor(0xfff4f7fb);
        if(bold)v.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        return v;
    }
    private Button button(String t){Button b=new Button(this);b.setText(t);return b;}
    private LinearLayout.LayoutParams lp(int w,int h){return new LinearLayout.LayoutParams(w,h);}
    private int dp(int v){return(int)(v*getResources().getDisplayMetrics().density+.5f);}

    @Override protected void onResume(){
        super.onResume();
        if(rotationSensor!=null)sensorManager.registerListener(this,rotationSensor,SensorManager.SENSOR_DELAY_GAME);
        if(waitingForSpatialPhoto){
            waitingForSpatialPhoto=false;
            new Handler(Looper.getMainLooper()).postDelayed(this::findAndAcceptLatestPhoto,800);
        }
    }
    @Override protected void onPause(){
        sensorManager.unregisterListener(this);
        super.onPause();
    }

    private void openSpatialCamera(){
        if(step>=sectors){status.setText("Круг уже завершён.");return;}
        if(zeroYaw==null){zeroYaw=yawDeg;createNewSession();}

        float err=shortest(targetAngle()-relativeYaw());
        if(step>0&&Math.abs(err)>Math.max(5f,180f/sectors)){
            status.setText(String.format(Locale.US,"Доверните к цели. Ошибка %.1f°",err));return;
        }
        if(Math.abs(pitchDeg)>18f||Math.abs(rollDeg)>18f){
            status.setText(String.format(Locale.US,"Выровняйте Beam Pro. Наклон %.1f° / %.1f°",pitchDeg,rollDeg));return;
        }

        Intent intent=new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA);
        ResolveInfo ri=getPackageManager().resolveActivity(intent,PackageManager.MATCH_DEFAULT_ONLY);
        if(ri==null){
            intent=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            ri=getPackageManager().resolveActivity(intent,PackageManager.MATCH_DEFAULT_ONLY);
        }
        if(ri==null){status.setText("Штатное приложение камеры не найдено.");return;}

        launchTimeMs=System.currentTimeMillis();
        waitingForSpatialPhoto=true;
        status.setText("В штатной камере снимите ОДИН кадр в режиме Spatial/3D и вернитесь назад.");
        try{startActivity(intent);}catch(Exception e){waitingForSpatialPhoto=false;status.setText("Не удалось открыть камеру: "+e.getMessage());}
    }

    private void findAndAcceptLatestPhoto(){
        PhotoRef p=queryLatestPhoto();
        if(p==null){
            status.setText("Новый снимок не найден. Повторите кадр и вернитесь назад.");
            return;
        }
        long launchSec=launchTimeMs/1000L;
        if(p.dateAddedSec<launchSec-2 || p.dateAddedSec<=lastAcceptedDateSec){
            status.setText("После запуска камеры новый снимок не найден. Нажмите «СНЯТЬ СТЕРЕОКАДР» ещё раз.");
            return;
        }

        float rel=relativeYaw();
        ShotMeta meta=new ShotMeta(step,rel,yawDeg,pitchDeg,rollDeg,System.currentTimeMillis(),p.uri.toString(),p.name,p.mime,p.dateAddedSec);
        if(copyIntoSession(p,meta)){
            shots.add(meta);
            lastAcceptedDateSec=p.dateAddedSec;
            step++;
            writeManifest();
            updateProgress();
            if(step>=sectors) status.setText("Готово: полный круг отснят. Все исходные Spatial-фото сохранены в сессии.");
            else status.setText("Кадр принят. Поверните Beam Pro к следующей метке и снимите следующий Spatial-кадр.");
        }
    }

    private boolean copyIntoSession(PhotoRef p,ShotMeta meta){
        if(sessionDir==null)return false;
        String ext=".jpg";
        if(p.name!=null&&p.name.contains(".")) ext=p.name.substring(p.name.lastIndexOf('.'));
        else if("image/heic".equalsIgnoreCase(p.mime)||"image/heif".equalsIgnoreCase(p.mime))ext=".heic";
        File out=new File(sessionDir,String.format(Locale.US,"spatial_%03d%s",step,ext));
        meta.localName=out.getName();
        try(InputStream in=getContentResolver().openInputStream(p.uri);FileOutputStream fos=new FileOutputStream(out)){
            if(in==null)throw new IOException("openInputStream=null");
            byte[] buf=new byte[65536];int n;while((n=in.read(buf))>0)fos.write(buf,0,n);
            return true;
        }catch(Exception e){status.setText("Не удалось скопировать снимок: "+e.getMessage());return false;}
    }

    private PhotoRef queryLatestPhoto(){
        Uri collection=MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        String[] proj={MediaStore.Images.Media._ID,MediaStore.Images.Media.DISPLAY_NAME,MediaStore.Images.Media.MIME_TYPE,MediaStore.Images.Media.DATE_ADDED,MediaStore.Images.Media.RELATIVE_PATH};
        try(Cursor c=getContentResolver().query(collection,proj,null,null,MediaStore.Images.Media.DATE_ADDED+" DESC")){
            if(c!=null&&c.moveToFirst()){
                long id=c.getLong(0);String name=c.getString(1),mime=c.getString(2);long date=c.getLong(3);String path=c.getString(4);
                return new PhotoRef(ContentUris.withAppendedId(collection,id),name,mime,date,path);
            }
        }catch(Exception e){status.setText("MediaStore: "+e.getMessage());}
        return null;
    }

    private void createNewSession(){
        String stamp=new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.US).format(new Date());
        sessionDir=new File(getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES),"XREAL_StereoPanorama/"+stamp);
        sessionDir.mkdirs();shots.clear();step=0;writeManifest();updateProgress();
    }

    private void writeManifest(){
        if(sessionDir==null)return;
        File f=new File(sessionDir,"session.json");
        try(PrintWriter w=new PrintWriter(new OutputStreamWriter(new FileOutputStream(f),"UTF-8"))){
            w.println("{");
            w.println("  \"format\": \"xreal-spatial-panorama-2\",");
            w.println("  \"captureMethod\": \"XREAL system spatial camera via MediaStore\",");
            w.println("  \"sectors\": "+sectors+",");
            w.println("  \"shots\": [");
            for(int i=0;i<shots.size();i++){
                ShotMeta s=shots.get(i);
                w.print(String.format(Locale.US,"    {\"index\":%d,\"relativeYaw\":%.3f,\"yaw\":%.3f,\"pitch\":%.3f,\"roll\":%.3f,\"timeMs\":%d,\"sourceUri\":\"%s\",\"sourceName\":\"%s\",\"mime\":\"%s\",\"file\":\"%s\"}",s.index,s.relativeYaw,s.yaw,s.pitch,s.roll,s.timeMs,esc(s.sourceUri),esc(s.sourceName),esc(s.mime),esc(s.localName)));
                w.println(i+1<shots.size()?",":"");
            }
            w.println("  ]");w.println("}");
        }catch(Exception ignored){}
    }

    private void showDiagnostics(){
        StringBuilder x=new StringBuilder();
        try{
            for(String id:cameraManager.getCameraIdList()){
                CameraCharacteristics c=cameraManager.getCameraCharacteristics(id);
                Integer facing=c.get(CameraCharacteristics.LENS_FACING);
                x.append("Camera ").append(id).append("  facing=").append(facing).append(facing!=null&&facing==1?" (BACK)":" (FRONT/OTHER)").append("\n");
                x.append("physicalIds=").append(c.getPhysicalCameraIds()).append("\n");
                int[] caps=c.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES);
                x.append("capabilities=").append(Arrays.toString(caps)).append("\n");
                Integer sync=c.get(CameraCharacteristics.LOGICAL_MULTI_CAMERA_SENSOR_SYNC_TYPE);
                if(sync!=null)x.append("syncType=").append(sync).append("\n");
                x.append("Vendor/extra keys:\n");
                for(CameraCharacteristics.Key<?> k:c.getKeys()){
                    String n=k.getName();
                    if(n!=null&&(n.toLowerCase(Locale.US).contains("vendor")||n.toLowerCase(Locale.US).contains("xreal")||n.toLowerCase(Locale.US).contains("stereo")||n.toLowerCase(Locale.US).contains("spatial")||n.toLowerCase(Locale.US).contains("aux")))
                        x.append("  ").append(n).append("\n");
                }
                x.append("\n");
            }

            Intent still=new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA);
            List<ResolveInfo> apps=getPackageManager().queryIntentActivities(still,PackageManager.MATCH_DEFAULT_ONLY);
            x.append("Camera apps for STILL_IMAGE_CAMERA:\n");
            for(ResolveInfo r:apps)x.append("  ").append(r.activityInfo.packageName).append("/").append(r.activityInfo.name).append("\n");
        }catch(Exception e){x.append("ERROR: ").append(e.getMessage());}

        TextView t=tv(x.toString(),12,false);t.setTextColor(0xff111111);t.setPadding(dp(12),dp(12),dp(12),dp(12));t.setTextIsSelectable(true);
        ScrollView s=new ScrollView(this);s.addView(t);
        new AlertDialog.Builder(this).setTitle("Beam Pro diagnostics").setView(s).setPositiveButton("OK",null).show();
    }


    private void showV4L2Diagnostics(){
        status.setText("Сканирую /dev/video* через NDK/V4L2…");
        new Thread(() -> {
            String json;
            try{
                json=NativeV4L2.probeJson();
            }catch(Throwable e){
                json="{\"error\":\""+esc(String.valueOf(e))+"\"}";
            }
            final String result=json;
            runOnUiThread(() -> {
                try{
                    JSONObject root=new JSONObject(result);
                    StringBuilder x=new StringBuilder();
                    if(root.has("error")) x.append("ERROR: ").append(root.optString("error")).append("\n");
                    JSONArray arr=root.optJSONArray("devices");
                    if(arr==null||arr.length()==0){
                        x.append("Видео-устройства /dev/video* не найдены.\n");
                    }else{
                        for(int i=0;i<arr.length();i++){
                            JSONObject d=arr.getJSONObject(i);
                            x.append(d.optString("path")).append("\n");
                            x.append(" opened=").append(d.optBoolean("opened"))
                             .append(" querycap=").append(d.optBoolean("querycap")).append("\n");
                            x.append(" driver=").append(d.optString("driver")).append("\n");
                            x.append(" card=").append(d.optString("card")).append("\n");
                            x.append(" bus=").append(d.optString("bus")).append("\n");
                            String err=d.optString("error");
                            if(!err.isEmpty())x.append(" error=").append(err).append("\n");
                            JSONArray fs=d.optJSONArray("formats");
                            if(fs!=null){
                                for(int j=0;j<fs.length();j++){
                                    JSONObject q=fs.getJSONObject(j);
                                    x.append("  ").append(q.optString("fourcc")).append(" ")
                                     .append(q.optInt("w")).append("x").append(q.optInt("h"));
                                    int fn=q.optInt("fpsNum"),fd=q.optInt("fpsDen");
                                    if(fn>0&&fd>0)x.append(" @ ").append((float)fn/fd);
                                    x.append("\n");
                                }
                            }
                            x.append("\n");
                        }
                    }

                    TextView t=tv(x.toString(),12,false);
                    t.setTextColor(0xff111111);t.setPadding(dp(12),dp(12),dp(12),dp(12));t.setTextIsSelectable(true);
                    ScrollView s=new ScrollView(this);s.addView(t);
                    new AlertDialog.Builder(this)
                            .setTitle("XREAL V4L2 /dev/video diagnostics")
                            .setView(s)
                            .setPositiveButton("OK",null)
                            .setNeutralButton("Тест кадра",(d,w)->testFirstV4L2Frame(result))
                            .show();
                    status.setText("V4L2 диагностика завершена.");
                }catch(Exception e){
                    status.setText("V4L2 JSON: "+e.getMessage()+"\n"+result);
                }
            });
        }).start();
    }

    private void testFirstV4L2Frame(String json){
        new Thread(() -> {
            String msg="Подходящее V4L2 устройство не найдено.";
            try{
                JSONObject root=new JSONObject(json);
                JSONArray arr=root.optJSONArray("devices");
                if(arr!=null){
                    outer:
                    for(int i=0;i<arr.length();i++){
                        JSONObject d=arr.getJSONObject(i);
                        if(!d.optBoolean("opened")||!d.optBoolean("querycap"))continue;
                        JSONArray fs=d.optJSONArray("formats");
                        if(fs==null)continue;
                        for(int j=0;j<fs.length();j++){
                            JSONObject q=fs.getJSONObject(j);
                            int w=q.optInt("w"),h=q.optInt("h");
                            String four=q.optString("fourcc");
                            int fi=q.optInt("fourccInt");
                            boolean preferred=(w==1536&&h==512)||(w==1280&&h==512)||(w==640&&h==512);
                            if(!preferred)continue;
                            byte[] data=NativeV4L2.captureFrame(d.optString("path"),w,h,fi);
                            if(data!=null&&data.length>0){
                                File dir=getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES);
                                File out=new File(dir,"xreal_v4l2_test_"+System.currentTimeMillis()+"_"+w+"x"+h+"_"+four+".bin");
                                try(FileOutputStream os=new FileOutputStream(out)){os.write(data);}
                                msg="УСПЕХ: "+d.optString("path")+" "+four+" "+w+"x"+h+
                                        "\nПолучено "+data.length+" байт"+
                                        "\nФайл: "+out.getAbsolutePath();
                            }else{
                                msg="Устройство найдено, но получить кадр не удалось: "+d.optString("path")+" "+four+" "+w+"x"+h;
                            }
                            break outer;
                        }
                    }
                }
            }catch(Throwable e){
                msg="V4L2 capture error: "+e;
            }
            final String outMsg=msg;
            runOnUiThread(() -> status.setText(outMsg));
        }).start();
    }

    private void resetSession(){zeroYaw=null;step=0;shots.clear();sessionDir=null;lastAcceptedDateSec=0;updateProgress();status.setText("Сессия сброшена.");}
    private void chooseSettings(){
        String[] items={"12 кадров (30°)","18 кадров (20°)","24 кадра (15°)","36 кадров (10°)"};
        int current=2;for(int i=0;i<sectorOptions.length;i++)if(sectorOptions[i]==sectors)current=i;
        new AlertDialog.Builder(this).setTitle("Количество позиций").setSingleChoiceItems(items,current,(d,w)->{sectors=sectorOptions[w];resetSession();d.dismiss();}).setNegativeButton("Отмена",null).show();
    }

    @Override public void onSensorChanged(SensorEvent e){
        if(e.sensor.getType()!=Sensor.TYPE_ROTATION_VECTOR)return;
        float[] r=new float[9],o=new float[3];SensorManager.getRotationMatrixFromVector(r,e.values);SensorManager.getOrientation(r,o);
        yawDeg=(float)Math.toDegrees(o[0]);pitchDeg=(float)Math.toDegrees(o[1]);rollDeg=(float)Math.toDegrees(o[2]);updateAngles();
    }
    @Override public void onAccuracyChanged(Sensor s,int a){}

    private float relativeYaw(){if(zeroYaw==null)return 0;float d=yawDeg-zeroYaw;while(d<0)d+=360;while(d>=360)d-=360;return d;}
    private float targetAngle(){return step*(360f/sectors);}
    private float shortest(float v){while(v>180)v-=360;while(v<-180)v+=360;return v;}
    private void updateAngles(){
        float cur=relativeYaw(),target=targetAngle(),err=shortest(target-cur);
        angleText.setText(String.format(Locale.US,"%.1f°  →  %.1f°\nΔ %.1f°",cur,target,err));
        angleText.setTextColor(Math.abs(err)<4?0xff67e480:0xfff4f7fb);
    }
    private void updateProgress(){progress.setMax(sectors);progress.setProgress(step);progressText.setText("Кадр "+step+" / "+sectors+"   •   шаг "+String.format(Locale.US,"%.1f°",360f/sectors));updateAngles();}
    private String esc(String s){if(s==null)return"";return s.replace("\\","\\\\").replace("\"","\\\"");}

    private static class PhotoRef{
        Uri uri;String name,mime,path;long dateAddedSec;
        PhotoRef(Uri u,String n,String m,long d,String p){uri=u;name=n;mime=m;dateAddedSec=d;path=p;}
    }
    private static class ShotMeta{
        int index;float relativeYaw,yaw,pitch,roll;long timeMs;String sourceUri,sourceName,mime,localName;
        ShotMeta(int i,float r,float y,float p,float ro,long t,String u,String n,String m,long d){index=i;relativeYaw=r;yaw=y;pitch=p;roll=ro;timeMs=t;sourceUri=u;sourceName=n;mime=m;}
    }
}
