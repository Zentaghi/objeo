package online.objeo.vision

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import kotlin.math.min
import kotlin.math.abs

private data class Features(val labels: Map<String, Float>, val hash: Long, val histogram: FloatArray)
class ObjeoVisionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ObjeoVision")
    AsyncFunction("rank") Coroutine { uri: String, candidates: List<String> ->
      withContext(Dispatchers.IO) {
        val ctx = appContext.reactContext ?: error("Application indisponible.")
        val local = Uri.parse(uri)
        require(local.scheme == "file" || local.scheme == "content") { "Photo locale invalide." }
        val model = ImageLabeling.getClient(ImageLabelerOptions.Builder().setConfidenceThreshold(0.35f).build())
        try {
          val original = ctx.contentResolver.openInputStream(local)?.use { decode(readBounded(it)) } ?: error("Photo illisible.")
          val query = try { fingerprint(original, model) } finally { original.recycle() }
          val rows = mutableListOf<Map<String, Any>>()
          var skipped = 0
          candidates.take(16).forEachIndexed { index, value ->
            try {
              val photo = download(value)
              val item = try { fingerprint(photo, model) } finally { photo.recycle() }
              val common = query.labels.keys.intersect(item.labels.keys)
              val union = query.labels.keys.union(item.labels.keys)
              val labels = if (union.isEmpty()) 0f else common.sumOf { min(query.labels[it] ?: 0f,item.labels[it] ?: 0f).toDouble() }.toFloat() / union.size
              val color = query.histogram.indices.sumOf { min(query.histogram[it],item.histogram[it]).toDouble() }.toFloat()
              val shape = 1f - java.lang.Long.bitCount(query.hash xor item.hash)/64f
              val score = (100 * (0.50f*labels + 0.30f*color + 0.20f*shape)).toInt().coerceIn(0,100)
              rows.add(mapOf("index" to index,"score" to score))
            } catch (_: Exception) { skipped++ }
          }
          mapOf("results" to rows.sortedByDescending { (it["score"] as Int) }, "skipped" to skipped)
        } finally { model.close() }
      }
    }
  }
  private fun readBounded(stream: InputStream): ByteArray {
    val out=ByteArrayOutputStream(); val buf=ByteArray(8192); var total=0
    while (true) { val n=stream.read(buf); if(n<0)break;total+=n;require(total<=8*1024*1024){"Photo trop volumineuse."};out.write(buf,0,n) }
    return out.toByteArray()
  }
  private fun decode(bytes: ByteArray): Bitmap {
    val info=BitmapFactory.Options().apply { inJustDecodeBounds=true }
    BitmapFactory.decodeByteArray(bytes,0,bytes.size,info)
    require(info.outWidth>0&&info.outHeight>0){"Format d’image non pris en charge."}
    var sample=1
    while(info.outWidth/sample>768||info.outHeight/sample>768) sample*=2
    return BitmapFactory.decodeByteArray(bytes,0,bytes.size,BitmapFactory.Options().apply {inSampleSize=sample;inPreferredConfig=Bitmap.Config.ARGB_8888}) ?: error("Photo illisible.")
  }
  private fun download(value:String): Bitmap {
    val u=URL(value)
    require(u.protocol=="https"&&u.host=="cvsecsmaczyadidapuyi.supabase.co"&&(u.port==-1||u.port==443)&&u.userInfo==null&&(u.path.startsWith("/storage/v1/object/public/ad-photos/")||u.path.startsWith("/storage/v1/object/public/objeo-pro-photos/"))){"Photo distante non autorisée."}
    val c=u.openConnection() as HttpURLConnection
    c.instanceFollowRedirects=false;c.connectTimeout=4000;c.readTimeout=4000
    try { require(c.responseCode==200){"Image indisponible."};return c.inputStream.use { decode(readBounded(it)) } } finally { c.disconnect() }
  }
  private fun fingerprint(image:Bitmap,model:com.google.mlkit.vision.label.ImageLabeler):Features {
    val labels=Tasks.await(model.process(InputImage.fromBitmap(image,0)),8,TimeUnit.SECONDS).associate { it.text.lowercase() to it.confidence }
    val small=Bitmap.createScaledBitmap(image,9,8,true)
    var hash=0L
    fun gray(c:Int)=Color.red(c)*299+Color.green(c)*587+Color.blue(c)*114
    for(y in 0..7)for(x in 0..7)if(gray(small.getPixel(x,y))>gray(small.getPixel(x+1,y)))hash=hash or (1L shl (y*8+x))
    if(small!==image)small.recycle()
    val hist=FloatArray(64);val thumb=Bitmap.createScaledBitmap(image,32,32,true)
    for(y in 0..31)for(x in 0..31){val c=thumb.getPixel(x,y);val idx=(Color.red(c)/64)*16+(Color.green(c)/64)*4+Color.blue(c)/64;hist[idx]+=1f/1024f}
    if(thumb!==image)thumb.recycle()
    return Features(labels,hash,hist)
  }
}
