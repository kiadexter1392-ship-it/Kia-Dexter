package com.example.ui.screens

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import com.example.R
import com.example.ui.theme.DojoGlassCanvasBot
import com.example.ui.theme.DojoGlassCanvasMid
import com.example.ui.theme.DojoGlassCanvasTop
import com.example.ui.theme.DojoGlassCardFrost
import com.example.ui.theme.DojoGold
import com.example.ui.theme.DojoGoldSoft
import com.example.ui.theme.DojoInk
import com.example.ui.theme.DojoMuted
import com.example.ui.theme.DojoPurpleBorderGlow
import com.example.ui.theme.DojoPurpleGlowSoft
import com.example.ui.theme.DojoPurpleImperial
import com.example.ui.theme.DojoPurpleOrchid
import com.example.ui.theme.DojoPurpleRoyal
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.max
import kotlin.math.min

private const val SITE_BASE_URL = "https://arsalan.up.railway.app/"

private val GLASS_THEME_AND_VIEWPORT_JS = """
(function(){
  if(!document.getElementById('dojo-viewport-fix')){
    var s=document.createElement('style');
    s.id='dojo-viewport-fix';
    s.textContent=
      'html,body{overflow-x:clip!important;max-width:100%!important;background:transparent!important;background-color:transparent!important;background-image:none!important;}' +
      'main,section,.section{overflow-x:clip!important;background:transparent!important;background-color:transparent!important;background-image:none!important;}' +
      'header,nav,.navbar,.topbar{background:rgba(255,255,255,0.72)!important;backdrop-filter:blur(16px) saturate(140%)!important;-webkit-backdrop-filter:blur(16px) saturate(140%)!important;border-bottom:1px solid rgba(109,40,217,0.14)!important;}' +
      '@media (max-width:768px){.bank-card-wrap{width:min(310px,100%)!important;height:204px!important;}}' +
      '.bank-face.bank-back{padding:14px 16px!important;justify-content:space-between!important;}' +
      '.bank-back .stripe{height:30px!important;}' +
      '.bank-back .label{margin-top:26px!important;}' +
      '.bank-back .number{direction:ltr!important;unicode-bidi:isolate!important;white-space:nowrap!important;font-size:clamp(14px,4.3vw,18px)!important;letter-spacing:1.5px!important;padding:4px 0!important;}' +
      '.bank-copy{position:relative!important;z-index:2!important;flex-shrink:0!important;min-height:38px!important;padding:8px 12px!important;}';
    (document.head||document.documentElement).appendChild(s);
  }
  if(window.scrollX!==0){window.scrollTo(0,window.scrollY);}
  if(!window.__dojoCopyPatched && window.AndroidDojoBridge && typeof window.doCopy==='function'){
    window.__dojoCopyPatched=true;
    var origCopy=window.doCopy;
    window.doCopy=function(btn,num){
      if(window.AndroidDojoBridge.copyText(num)){
        btn.innerHTML='<span>✅</span> کپی شد';
        btn.style.background='rgba(74,222,128,0.2)';
        setTimeout(function(){btn.innerHTML='<span>📋</span> کپی';btn.style.background='';},2500);
        var box=document.getElementById('toastBox');
        if(box){
          var el=document.createElement('div');
          el.className='toast ok';
          el.textContent='شماره کارت با موفقیت کپی شد';
          box.appendChild(el);
          setTimeout(function(){if(el.parentNode)el.remove();},3500);
        }
        return;
      }
      origCopy(btn,num);
    };
  }
})();
""".trimIndent()

private class AndroidDojoBridge(private val context: Context) {
    @JavascriptInterface
    fun copyText(text: String?): Boolean {
        if (text.isNullOrEmpty()) return false
        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
        cm.setPrimaryClip(ClipData.newPlainText("arslan_dojo", text))
        return true
    }
}

/**
 * Drop-in Android WebView-hardened OneTimeCode implementation:
 * - Preserves the exact visual design, dimensions, spring capsule, reset/focus API, and callbacks
 * - Forces LTR & tel keypad so Gboard/IME never scrambles digits or renders a black selection block
 * - Avoids 60fps DOM innerHTML recreation & SVG goo blur filter lag
 * - Converts Persian/Arabic digits to ASCII and triggers immediate redraw on Backspace/blur
 */
private val SMOOTH_ONE_TIME_CODE_JS = """
(function() {
  'use strict';
  var W = 40;
  var H = 50;
  var G = 8;
  var CAP = 160;
  var POP_MS = 220;
  var SHAKE_MS = 600;
  var MERGE_K = 0.085;
  var MERGE_D = 1 - 2 * 0.45 * Math.sqrt(MERGE_K);

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) {
    var u = clamp((v - a) / (b - a), 0, 1);
    return u * u * (3 - 2 * u);
  }
  function normalizeDigits(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      if (ch >= 48 && ch <= 57) {
        out += str[i];
      } else if (ch >= 1776 && ch <= 1785) {
        out += String.fromCharCode(ch - 1728);
      } else if (ch >= 1632 && ch <= 1641) {
        out += String.fromCharCode(ch - 1584);
      }
    }
    return out;
  }

  function OneTimeCode(container, options) {
    if (!container) return null;
    container.innerHTML = '';
    options = options || {};
    var length = options.length || 6;
    var answer = options.answer || 'Accept';
    var onVerify = options.onVerify || function() {};
    var code = '';
    var phase = 'type';
    var focus = false;
    var caret = { x: W / 2, v: 0 };
    var popAt = [];
    var prevDigits = [];
    var mergeState = { m: 0, v: 0, to: 0 };
    var shookAt = 0;
    var rafId = 0;

    var root = document.createElement('div');
    root.className = 'otp';
    root.dir = 'ltr';
    root.style.direction = 'ltr';
    var rowW = length * W + (length - 1) * G;

    var row = document.createElement('div');
    row.className = 'otp-row';
    row.dir = 'ltr';
    row.style.direction = 'ltr';
    row.style.width = rowW + 'px';
    row.style.height = H + 'px';

    var gooLayer = document.createElement('div');
    gooLayer.className = 'otp-goo';
    row.appendChild(gooLayer);

    var slots = [];
    var digitNodes = [];
    for (var i = 0; i < length; i++) {
      var slot = document.createElement('span');
      slot.className = 'otp-slot';
      slot.style.width = W + 'px';
      slot.style.pointerEvents = 'none';
      var dNode = document.createElement('span');
      dNode.className = 'otp-digit';
      dNode.style.animation = 'none';
      dNode.style.willChange = 'transform, opacity';
      dNode.style.display = 'none';
      slot.appendChild(dNode);
      slots.push(slot);
      digitNodes.push(dNode);
      row.appendChild(slot);
      prevDigits.push('');
    }

    var caretEl = document.createElement('i');
    caretEl.className = 'otp-caret';
    row.appendChild(caretEl);

    var okEl = document.createElement('span');
    okEl.className = 'otp-ok';
    okEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> تأیید شد';
    row.appendChild(okEl);

    var input = document.createElement('input');
    input.className = 'otp-field';
    input.type = 'tel';
    input.dir = 'ltr';
    input.inputMode = 'numeric';
    input.setAttribute('pattern', '[0-9]*');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('data-1p-ignore', '');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('maxlength', length);
    input.setAttribute('aria-label', length + '-digit code');
    input.spellcheck = false;
    input.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0.001;border:0;padding:0;margin:0;font-size:16px;direction:ltr;text-align:left;color:transparent;-webkit-text-fill-color:transparent;caret-color:transparent;background:transparent;outline:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;';
    row.appendChild(input);

    root.appendChild(row);
    container.appendChild(root);

    var cellNodes = [];
    var capsuleNode = null;
    function buildCells() {
      gooLayer.innerHTML = '';
      cellNodes = [];
      for (var i = 0; i < length; i++) {
        var cell = document.createElement('span');
        cell.className = 'otp-cell';
        cell.style.width = W + 'px';
        cell.style.borderRadius = '10px';
        cell.style.willChange = 'transform';
        gooLayer.appendChild(cell);
        cellNodes.push(cell);
      }
      capsuleNode = document.createElement('span');
      capsuleNode.className = 'otp-cell otp-capsule';
      capsuleNode.style.borderRadius = (H / 2) + 'px';
      capsuleNode.style.display = 'none';
      gooLayer.appendChild(capsuleNode);
    }
    buildCells();

    function pinCursorEnd() {
      try {
        var len = input.value.length;
        input.setSelectionRange(len, len);
      } catch (_) {}
    }

    function wake() {
      if (rafId) return;
      var prev = 0;
      function tick(t) {
        var dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
        prev = t;
        var busy = false;

        var target = Math.min(code.length, length - 1) * (W + G) + W / 2;
        caret.v += (target - caret.x) * 0.25 * dt;
        caret.v *= Math.pow(0.58, dt);
        caret.x += caret.v * dt;
        if (Math.abs(target - caret.x) < 0.1 && Math.abs(caret.v) < 0.1) {
          caret.x = target; caret.v = 0;
        } else { busy = true; }

        var mg = mergeState;
        if (mg.m !== mg.to || mg.v !== 0) {
          mg.v += (mg.to - mg.m) * MERGE_K * dt;
          mg.v *= Math.pow(MERGE_D, dt);
          mg.m += mg.v * dt;
          if (Math.abs(mg.to - mg.m) < 0.001 && Math.abs(mg.v) < 0.001) {
            mg.m = mg.to; mg.v = 0;
          } else { busy = true; }
        }

        if (phase === 'no' && performance.now() - shookAt < SHAKE_MS + 150) busy = true;
        if (phase === 'check') busy = true;
        for (var pi = 0; pi < popAt.length; pi++) {
          if (popAt[pi] !== undefined && performance.now() - popAt[pi] < POP_MS) { busy = true; break; }
        }

        render();
        rafId = busy ? requestAnimationFrame(tick) : 0;
      }
      rafId = requestAnimationFrame(tick);
    }

    function fuse(to) {
      mergeState = { m: mergeState.m, v: mergeState.v, to: to };
      wake();
    }

    function render() {
      var now = performance.now();
      var raw = mergeState.m;
      var m = clamp(raw, 0, 1);
      var mid = (rowW - W) / 2;
      var since = now - shookAt;
      var shaking = phase === 'no' && since < SHAKE_MS;

      for (var i = 0; i < length; i++) {
        var home = i * (W + G);
        var shake = shaking ? 5 * Math.exp(-since / 190) * Math.sin((since / 1000) * Math.PI * 2 * 10 + i * 0.55) : 0;
        var x = mix(home, mid, m) + shake;

        var at = popAt[i];
        var popScale = 1;
        if (at !== undefined) {
          var u = (now - at) / POP_MS;
          if (u > 0 && u < 1) popScale = 1 + 0.06 * Math.sin(Math.PI * u);
        }

        var breathScale = popScale;
        if (phase === 'check') {
          var bu = ((now % 900) / 900) * (length + 2) - i;
          if (bu > 0 && bu < 2) breathScale *= 1 - 0.07 * Math.sin((bu / 2) * Math.PI);
        }

        var cell = cellNodes[i];
        if (cell) {
          var cellR = mix(10, H / 2, smooth(0.15, 0.7, m));
          cell.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0) scale(' + breathScale.toFixed(3) + ')';
          cell.style.borderRadius = cellR.toFixed(1) + 'px';
          cell.style.opacity = String(1 - smooth(0.25, 0.65, m));
        }

        slots[i].style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
        slots[i].style.opacity = String(1 - smooth(0, 0.4, m));

        var d = code[i] || '';
        var dNode = digitNodes[i];
        if (d !== prevDigits[i]) {
          prevDigits[i] = d;
          dNode.textContent = d;
          dNode.style.display = d ? 'block' : 'none';
        }
        if (d) {
          if (phase === 'no') {
            var out = smooth(0, 1, (since - 260 - (length - 1 - i) * 40) / 200);
            dNode.style.transform = 'translate3d(0,' + (out * 8).toFixed(2) + 'px,0)';
            dNode.style.opacity = String(1 - out);
          } else if (at !== undefined && (now - at) < POP_MS) {
            var pu = clamp((now - at) / POP_MS, 0, 1);
            var ease = 1 - Math.pow(1 - pu, 3);
            dNode.style.transform = 'translate3d(0,' + ((1 - ease) * 6).toFixed(2) + 'px,0) scale(' + (0.88 + 0.12 * ease).toFixed(3) + ')';
            dNode.style.opacity = String(ease);
          } else {
            dNode.style.transform = 'none';
            dNode.style.opacity = '1';
          }
        }
      }

      var over = raw - 1;
      var capW = CAP * smooth(0.2, 1, m) * (1 + Math.max(-0.12, over) * 0.9);
      var capSy = 1 - Math.max(-0.12, over) * 0.55;
      if (capsuleNode && capW > 1) {
        capsuleNode.style.display = '';
        capsuleNode.style.width = capW.toFixed(1) + 'px';
        capsuleNode.style.transform = 'translate3d(' + ((rowW - capW) / 2).toFixed(2) + 'px,0,0) scaleY(' + capSy.toFixed(3) + ')';
      } else if (capsuleNode) {
        capsuleNode.style.display = 'none';
      }

      var typing = phase === 'type' && focus;
      caretEl.setAttribute('data-on', typing && code.length < length && m < 0.08 ? 'true' : '');
      caretEl.style.transform = 'translate3d(' + (caret.x - 1).toFixed(2) + 'px,0,0) scaleX(' + (1 + Math.min(3, Math.abs(caret.v) * 0.5)).toFixed(3) + ')';

      okEl.style.opacity = String(smooth(0.68, 1, m));
      okEl.style.transform = 'scale(' + mix(0.92, 1, smooth(0.68, 1, m)).toFixed(3) + ')';
      root.setAttribute('data-phase', phase);
    }

    input.addEventListener('input', function(e) {
      if (phase !== 'type') {
        input.value = code;
        return;
      }
      var next = normalizeDigits(input.value).slice(0, length);
      if (input.value !== next) {
        input.value = next;
      }
      pinCursorEnd();
      if (next === code) return;

      if (next.length > code.length) {
        var t0 = performance.now();
        for (var i = code.length; i < next.length; i++) {
          popAt[i] = t0 + (i - code.length) * 30;
        }
      } else {
        for (var j = next.length; j < length; j++) {
          popAt[j] = undefined;
        }
      }
      code = next;
      wake();

      if (code.length < length) return;

      phase = 'check';
      wake();
      setTimeout(function() {
        if (answer !== 'Reject') {
          phase = 'ok';
          fuse(1);
          input.blur();
          if (onVerify) onVerify(code);
        } else {
          phase = 'no';
          shookAt = performance.now();
          wake();
          setTimeout(function() {
            code = '';
            phase = 'type';
            input.value = '';
            popAt = [];
            prevDigits = [];
            for (var k = 0; k < length; k++) prevDigits.push('');
            render();
            wake();
          }, SHAKE_MS + length * 40 + 160);
        }
      }, 280);
    });

    input.addEventListener('focus', function() {
      focus = true;
      requestAnimationFrame(pinCursorEnd);
      wake();
    });
    input.addEventListener('blur', function() {
      focus = false;
      wake();
    });
    function reopenFromOk() {
      if (phase !== 'ok') return;
      code = '';
      phase = 'type';
      fuse(0);
      input.value = '';
      popAt = [];
      for (var i = 0; i < length; i++) prevDigits[i] = '';
      render();
      input.focus();
      requestAnimationFrame(pinCursorEnd);
    }

    input.addEventListener('click', function() {
      if (phase === 'ok') {
        reopenFromOk();
        return;
      }
      requestAnimationFrame(pinCursorEnd);
    });

    okEl.addEventListener('click', reopenFromOk);

    row.addEventListener('click', function() {
      if (phase === 'ok') {
        reopenFromOk();
        return;
      }
      input.focus();
      requestAnimationFrame(pinCursorEnd);
    });

    render();
    return {
      reset: function() {
        code = '';
        phase = 'type';
        mergeState = { m: 0, v: 0, to: 0 };
        caret = { x: W / 2, v: 0 };
        popAt = [];
        for (var i = 0; i < length; i++) prevDigits[i] = '';
        input.value = '';
        render();
      },
      focus: function() {
        input.focus();
        requestAnimationFrame(pinCursorEnd);
      }
    };
  }

  window.OneTimeCode = {
    mount: function(container, options) {
      return OneTimeCode(container, options);
    }
  };
})();
""".trimIndent()

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun DojoPortalScreen(
    reloadSignal: Int = 0,
    onToast: (String) -> Unit
) {
    val scope = rememberCoroutineScope()

    var loadProgress by remember { mutableIntStateOf(0) }
    var canGoBack by remember { mutableStateOf(false) }
    var hasLoadError by remember { mutableStateOf(false) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    LaunchedEffect(reloadSignal) {
        if (reloadSignal > 0) {
            hasLoadError = false
            webViewRef?.reload()
        }
    }

    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = if (result.resultCode == Activity.RESULT_OK) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        } else null
        filePathCallback?.onReceiveValue(uris)
        filePathCallback = null
    }

    BackHandler(enabled = canGoBack) {
        webViewRef?.goBack()
    }

    DisposableEffect(Unit) {
        onDispose {
            runCatching { CookieManager.getInstance().flush() }
            webViewRef?.destroy()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LuxuryPurpleAmbientBackdrop(modifier = Modifier.fillMaxSize())

        Box(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
        ) {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        WebView(ctx).apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                            setBackgroundColor(android.graphics.Color.TRANSPARENT)
                            setLayerType(View.LAYER_TYPE_HARDWARE, null)
                            overScrollMode = View.OVER_SCROLL_NEVER
                            isVerticalScrollBarEnabled = true
                            isHorizontalScrollBarEnabled = false
                            val webView = this
                            addJavascriptInterface(AndroidDojoBridge(ctx), "AndroidDojoBridge")
                            CookieManager.getInstance().apply {
                                setAcceptCookie(true)
                                setAcceptThirdPartyCookies(webView, true)
                            }
                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            cacheMode = WebSettings.LOAD_DEFAULT
                            loadsImagesAutomatically = true
                            useWideViewPort = false
                            loadWithOverviewMode = false
                            setSupportZoom(false)
                            builtInZoomControls = false
                            displayZoomControls = false
                            textZoom = 100
                            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                loadProgress = newProgress
                            }

                            override fun onShowFileChooser(
                                webView: WebView?,
                                callback: ValueCallback<Array<Uri>>?,
                                params: FileChooserParams?
                            ): Boolean {
                                filePathCallback?.onReceiveValue(null)
                                filePathCallback = callback
                                return try {
                                    val intent = params?.createIntent()
                                        ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                            addCategory(Intent.CATEGORY_OPENABLE)
                                            type = "*/*"
                                        }
                                    filePickerLauncher.launch(intent)
                                    true
                                } catch (_: Exception) {
                                    filePathCallback = null
                                    false
                                }
                            }
                        }

                        webViewClient = object : WebViewClient() {
                            override fun shouldInterceptRequest(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): WebResourceResponse? {
                                val uri = request?.url ?: return null
                                val host = uri.host?.lowercase() ?: ""
                                val path = uri.path ?: ""
                                if ((host == "arsalan.up.railway.app" || host.endsWith(".arsalan.up.railway.app")) &&
                                    (path == "/OneTimeCode.js" || path.endsWith("/OneTimeCode.js"))
                                ) {
                                    return WebResourceResponse(
                                        "application/javascript",
                                        "UTF-8",
                                        ByteArrayInputStream(SMOOTH_ONE_TIME_CODE_JS.toByteArray(Charsets.UTF_8))
                                    )
                                }
                                return super.shouldInterceptRequest(view, request)
                            }

                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                hasLoadError = false
                                canGoBack = view?.canGoBack() == true
                            }

                            override fun onPageCommitVisible(view: WebView?, url: String?) {
                                view?.evaluateJavascript(GLASS_THEME_AND_VIEWPORT_JS, null)
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                canGoBack = view?.canGoBack() == true
                                view?.evaluateJavascript(GLASS_THEME_AND_VIEWPORT_JS, null)
                                scope.launch(Dispatchers.IO) {
                                    runCatching { CookieManager.getInstance().flush() }
                                }
                            }

                            override fun shouldOverrideUrlLoading(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): Boolean {
                                val uri = request?.url ?: return false
                                val scheme = uri.scheme?.lowercase() ?: ""
                                if (scheme == "about" || scheme == "javascript" || scheme == "data" || scheme == "blob") {
                                    return false
                                }
                                if (scheme == "tel" || scheme == "mailto" || scheme == "sms") {
                                    val action = if (scheme == "tel") Intent.ACTION_DIAL else Intent.ACTION_VIEW
                                    runCatching { ctx.startActivity(Intent(action, uri)) }
                                        .onFailure { onToast("برنامه‌ای برای باز کردن این لینک یافت نشد") }
                                    return true
                                }
                                val host = uri.host?.lowercase() ?: ""
                                return if (host == "arsalan.up.railway.app" || host.endsWith(".arsalan.up.railway.app")) {
                                    false
                                } else {
                                    runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                                        .onFailure { onToast("امکان باز کردن لینک خارجی وجود ندارد") }
                                    true
                                }
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: WebResourceError?
                            ) {
                                if (request?.isForMainFrame == true) {
                                    val code = error?.errorCode ?: 0
                                    if (code != -1 && code != ERROR_UNSUPPORTED_SCHEME) {
                                        if (!hasLoadError) {
                                            onToast(ctx.getString(R.string.error_server_connection))
                                        }
                                        hasLoadError = true
                                    }
                                }
                            }
                        }

                        setDownloadListener { downloadUrl, _, contentDisposition, mimeType, _ ->
                            scope.launch {
                                val shared = downloadAndShareFile(
                                    context = ctx,
                                    url = downloadUrl,
                                    contentDisposition = contentDisposition,
                                    mimeType = mimeType
                                )
                                if (!shared) {
                                    onToast("خطا در دریافت فایل خروجی")
                                }
                            }
                        }

                        loadUrl(SITE_BASE_URL)
                        webViewRef = this
                    }
                }
            )
        }

        if (loadProgress in 1..99) {
            LinearProgressIndicator(
                progress = { loadProgress / 100f },
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter),
                color = DojoGold,
                trackColor = DojoGoldSoft
            )
        }

        if (hasLoadError) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    modifier = Modifier.widthIn(max = 360.dp),
                    shape = RoundedCornerShape(24.dp),
                    color = DojoGlassCardFrost,
                    border = BorderStroke(1.dp, DojoPurpleBorderGlow)
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.WifiOff,
                            contentDescription = "عدم اتصال به اینترنت",
                            tint = DojoPurpleRoyal,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "اتصال به سرور برقرار نشد",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = DojoInk,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            text = "لطفاً اتصال اینترنت خود را بررسی کنید و دوباره تلاش نمایید.",
                            style = MaterialTheme.typography.bodySmall,
                            color = DojoMuted,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Button(
                            onClick = {
                                hasLoadError = false
                                webViewRef?.reload()
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("portal_retry_btn"),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = DojoPurpleRoyal,
                                contentColor = Color.White
                            )
                        ) {
                            Text("تلاش مجدد", style = MaterialTheme.typography.labelLarge)
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
private fun LuxuryPurpleAmbientBackdrop(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "royal_purple_glow")
    val driftPrimary by transition.animateFloat(
        initialValue = -0.04f,
        targetValue = 0.04f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 9000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "drift_primary"
    )
    val driftSecondary by transition.animateFloat(
        initialValue = 0.04f,
        targetValue = -0.04f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 12000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "drift_secondary"
    )

    Canvas(modifier = modifier) {
        drawRect(
            brush = Brush.verticalGradient(
                colors = listOf(DojoGlassCanvasTop, DojoGlassCanvasMid, DojoGlassCanvasBot)
            )
        )

        val maxDim = max(size.width, size.height)
        val minDim = min(size.width, size.height)

        // Focused rich royal-purple light glow radiating from upper-left
        val topLeftLight = Offset(
            x = size.width * (0.08f + driftPrimary * 0.6f),
            y = size.height * (0.22f - driftSecondary * 0.5f)
        )
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    DojoPurpleImperial.copy(alpha = 0.42f),
                    DojoPurpleRoyal.copy(alpha = 0.28f),
                    DojoPurpleOrchid.copy(alpha = 0.12f),
                    Color.Transparent
                ),
                center = topLeftLight,
                radius = minDim * 0.85f
            ),
            radius = minDim * 0.85f,
            center = topLeftLight
        )

        // Focused luminous amethyst light orb along lower-right edge
        val bottomRightLight = Offset(
            x = size.width * (0.94f + driftSecondary * 0.6f),
            y = size.height * (0.74f + driftPrimary * 0.5f)
        )
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    DojoPurpleRoyal.copy(alpha = 0.40f),
                    DojoPurpleOrchid.copy(alpha = 0.22f),
                    DojoPurpleGlowSoft.copy(alpha = 0.08f),
                    Color.Transparent
                ),
                center = bottomRightLight,
                radius = maxDim * 0.50f
            ),
            radius = maxDim * 0.50f,
            center = bottomRightLight
        )

        // Subtle mid-left velvet violet edge halo
        val midAccentLight = Offset(
            x = size.width * (0.14f - driftPrimary * 0.4f),
            y = size.height * (0.88f + driftSecondary * 0.4f)
        )
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    DojoPurpleGlowSoft.copy(alpha = 0.28f),
                    DojoPurpleOrchid.copy(alpha = 0.12f),
                    Color.Transparent
                ),
                center = midAccentLight,
                radius = minDim * 0.65f
            ),
            radius = minDim * 0.65f,
            center = midAccentLight
        )

        // Frosted glass sheen layer over the light sources
        drawRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    Color.White.copy(alpha = 0.34f),
                    Color.White.copy(alpha = 0.14f),
                    Color.White.copy(alpha = 0.28f)
                )
            )
        )
    }
}

private suspend fun downloadAndShareFile(
    context: Context,
    url: String,
    contentDisposition: String?,
    mimeType: String?
): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = true
            connectTimeout = 8000
            readTimeout = 8000
            CookieManager.getInstance().getCookie(url)?.let { cookie ->
                setRequestProperty("Cookie", cookie)
            }
        }
        val status = conn.responseCode
        if (status !in 200..299) {
            conn.disconnect()
            return@withContext false
        }
        val rawName = contentDisposition
            ?.substringAfter("filename=", "")
            ?.trim('"', ' ', ';')
            ?.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            ?.takeIf { it.isNotEmpty() }
            ?: "arslan-dojo-export.csv"
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val target = File(dir, rawName)
        conn.inputStream.use { input ->
            target.outputStream().use { out -> input.copyTo(out) }
        }
        conn.disconnect()

        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", target)
        withContext(Dispatchers.Main) {
            val share = Intent(Intent.ACTION_SEND).apply {
                type = mimeType ?: "text/csv"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(share, rawName))
        }
        true
    }.getOrDefault(false)
}
