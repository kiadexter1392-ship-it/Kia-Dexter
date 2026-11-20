package com.example.ui.screens

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
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
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.RestaurantMenu
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.R
import com.example.ui.theme.DojoCreamBot
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

private fun isLoginRouteUrl(url: String?): Boolean {
    val lower = url?.lowercase() ?: return false
    return Regex("""(/(login|signin|auth|register)(/|$|\?|#)|#(login|signin|auth))""").containsMatchIn(lower)
}

private val GLASS_THEME_AND_VIEWPORT_JS = """
(function(){
  if(!document.getElementById('dojo-viewport-fix')){
    var s=document.createElement('style');
    s.id='dojo-viewport-fix';
    s.textContent=
      'html,body{overflow-x:clip!important;max-width:100%!important;}' +
      'html:not(.dojo-login-active),html:not(.dojo-login-active) body{background:transparent!important;background-color:transparent!important;background-image:none!important;}' +
      'html:not(.dojo-login-active) main,html:not(.dojo-login-active) section:not([data-dojo-login-box="1"]),html:not(.dojo-login-active) .section:not([data-dojo-login-box="1"]),html:not(.dojo-login-active) .page,html:not(.dojo-login-active) .view,html:not(.dojo-login-active) .tab-pane,html:not(.dojo-login-active) .dashboard,html:not(.dojo-login-active) #app,html:not(.dojo-login-active) #root,html:not(.dojo-login-active) #main,html:not(.dojo-login-active) .panel-shell,html:not(.dojo-login-active) .panel-wrap,html:not(.dojo-login-active) .panel-page{overflow-x:clip!important;background:transparent!important;background-color:transparent!important;background-image:none!important;}' +
      'html:not(.dojo-login-active) header,html:not(.dojo-login-active) nav,html:not(.dojo-login-active) .navbar,html:not(.dojo-login-active) .topbar{background:rgba(248,242,255,0.62)!important;backdrop-filter:blur(18px) saturate(155%)!important;-webkit-backdrop-filter:blur(18px) saturate(155%)!important;border-bottom:1px solid rgba(109,40,217,0.22)!important;box-shadow:0 8px 26px rgba(76,29,149,0.10)!important;}' +
      'html:not(.dojo-login-active) .panel:not([data-dojo-login-box="1"]),html:not(.dojo-login-active) .glass:not([data-dojo-login-box="1"]),html:not(.dojo-login-active) .info-card:not([data-dojo-login-box="1"]),html:not(.dojo-login-active) .plan-card:not([data-dojo-login-box="1"]),html:not(.dojo-login-active) .contact-card:not([data-dojo-login-box="1"]){background:rgba(255,255,255,0.44)!important;backdrop-filter:blur(16px) saturate(150%)!important;-webkit-backdrop-filter:blur(16px) saturate(150%)!important;border:1px solid rgba(255,255,255,0.68)!important;box-shadow:0 12px 30px rgba(76,29,149,0.12)!important;}' +
      '[data-dojo-login-box="1"]{background:#F0EDE6!important;background-color:#F0EDE6!important;background-image:none!important;}' +
      'html.dojo-login-active,html.dojo-login-active body{background:#F0EDE6!important;background-color:#F0EDE6!important;}' +
      '@media (max-width:768px){.bank-card-wrap{width:min(310px,100%)!important;height:204px!important;}}' +
      '.bank-face.bank-back{padding:14px 16px!important;justify-content:space-between!important;}' +
      '.bank-back .stripe{height:30px!important;}' +
      '.bank-back .label{margin-top:26px!important;}' +
      '.bank-back .number{direction:ltr!important;unicode-bidi:isolate!important;white-space:nowrap!important;font-size:clamp(14px,4.3vw,18px)!important;letter-spacing:1.5px!important;padding:4px 0!important;}' +
      '.bank-copy{position:relative!important;z-index:2!important;flex-shrink:0!important;min-height:38px!important;padding:8px 12px!important;}';
    (document.head||document.documentElement).appendChild(s);
  }
  function isVisible(el){
    if(!el)return false;
    var st=window.getComputedStyle(el);
    if(!st || st.display==='none' || st.visibility==='hidden' || parseFloat(st.opacity)===0)return false;
    var r=el.getBoundingClientRect();
    return r.width>0 && r.height>0;
  }
  function syncLoginAndPanelState(){
    var href=(location.pathname+location.search+location.hash).toLowerCase();
    var isLoginUrl=/\/(login|signin|auth|register)(\/|$|\?|#)|#(login|signin|auth)/.test(href);
    var oldBoxes=document.querySelectorAll('[data-dojo-login-box="1"]');
    for(var k=0;k<oldBoxes.length;k++) oldBoxes[k].removeAttribute('data-dojo-login-box');

    var vw=window.innerWidth||360, vh=window.innerHeight||640;
    var loginBoxes=[];
    var loginInputs=document.querySelectorAll('.otc-input, input[type="password"], input[autocomplete="current-password"], input[name*="pass" i], input[placeholder*="رمز"]');
    for(var i=0;i<loginInputs.length;i++){
      var inp=loginInputs[i];
      if(!isVisible(inp)) continue;
      var box=inp.closest('form, .login-box, .login-card, .auth-card, .auth-box, .modal-card, .modal-content, section, .section') || inp.parentElement;
      if(!box || box===document.body || box===document.documentElement || box.id==='app' || box.id==='root') continue;
      if(box.querySelector('table, .bank-card-wrap, header, nav')) continue;
      if(loginBoxes.indexOf(box)===-1){
        loginBoxes.push(box);
      }
    }

    var namedLoginBoxes=document.querySelectorAll('.login-box, .login-card, .auth-card, .auth-box, #loginSection, #loginBox, #loginModal');
    for(var n=0;n<namedLoginBoxes.length;n++){
      var nb=namedLoginBoxes[n];
      if(!isVisible(nb)) continue;
      if(nb.querySelector('input, .otc-input') && !nb.querySelector('table, .bank-card-wrap, header, nav')){
        if(loginBoxes.indexOf(nb)===-1) loginBoxes.push(nb);
      }
    }

    for(var j=0;j<loginBoxes.length;j++){
      loginBoxes[j].setAttribute('data-dojo-login-box','1');
    }

    var hasOtherVisibleSections=false;
    var nonLoginBlocks=document.querySelectorAll('section, .section, .bank-card-wrap, .panel, .dashboard, table, .tab-pane, .plan-card');
    for(var b=0;b<nonLoginBlocks.length;b++){
      var blk=nonLoginBlocks[b];
      if(!isVisible(blk)) continue;
      if(blk.getAttribute('data-dojo-login-box')==='1' || blk.closest('[data-dojo-login-box="1"]') || blk.querySelector('[data-dojo-login-box="1"]')) continue;
      var br=blk.getBoundingClientRect();
      if(br.height>=70 && br.width>=120){
        hasOtherVisibleSections=true;
        break;
      }
    }

    var hasFullLogin=isLoginUrl;
    if(!hasFullLogin && loginBoxes.length>0 && !hasOtherVisibleSections){
      hasFullLogin=true;
    }

    document.documentElement.classList.toggle('dojo-login-active', !!hasFullLogin);
    if(window.AndroidDojoBridge && typeof window.AndroidDojoBridge.setLoginScreenActive==='function'){
      window.AndroidDojoBridge.setLoginScreenActive(!!hasFullLogin);
    }

    var isPanelUrl=/\/(panel|dashboard|coach|member|student|admin|profile)(\/|$|\?|#)|#(panel|dashboard|coach|member|student)/.test(href);
    var hasLogoutControl=false;
    var logoutCandidates=document.querySelectorAll('[id*="logout" i], [class*="logout" i], a[href*="logout" i], button, a');
    for(var lc=0;lc<logoutCandidates.length;lc++){
      var lEl=logoutCandidates[lc];
      if(!isVisible(lEl)) continue;
      if(lEl.matches('[id*="logout" i], [class*="logout" i], a[href*="logout" i]')){
        hasLogoutControl=true;
        break;
      }
      var lTxt=(lEl.textContent||'').replace(/\s+/g,' ').trim();
      if(lTxt.length>0 && lTxt.length<=28 && (lTxt.indexOf('خروج')!==-1 || /logout|sign\s*out/i.test(lTxt))){
        hasLogoutControl=true;
        break;
      }
    }

    var hasVisibleLoginTrigger=false;
    var loginTriggers=document.querySelectorAll('button, a');
    for(var lt=0;lt<loginTriggers.length;lt++){
      var tEl=loginTriggers[lt];
      if(!isVisible(tEl)) continue;
      var tTxt=(tEl.textContent||'').replace(/\s+/g,' ').trim();
      if(tTxt==='ورود' || tTxt==='ورود به پنل' || tTxt==='ورود / ثبت‌نام' || tTxt==='ثبت نام' || tTxt==='ثبت‌نام'){
        hasVisibleLoginTrigger=true;
        break;
      }
    }

    var isAuthenticated=false;
    if(!hasFullLogin && !isLoginUrl){
      if(hasLogoutControl){
        isAuthenticated=true;
      }else if(isPanelUrl && loginBoxes.length===0){
        isAuthenticated=true;
      }else if(loginBoxes.length===0 && !hasVisibleLoginTrigger){
        var panelEls=document.querySelectorAll('.dashboard, .panel-shell, .panel-wrap, .coach-panel, .member-panel, [id*="panel" i], [class*="panel" i]');
        for(var pe=0;pe<panelEls.length;pe++){
          if(isVisible(panelEls[pe])){
            isAuthenticated=true;
            break;
          }
        }
      }
    }

    if(window.AndroidDojoBridge && typeof window.AndroidDojoBridge.setAuthenticatedState==='function'){
      window.AndroidDojoBridge.setAuthenticatedState(!!isAuthenticated);
    }

    if(hasFullLogin && document.body){
      var prevWrappers=document.querySelectorAll('[data-dojo-panel-bg="1"]');
      for(var pw=0;pw<prevWrappers.length;pw++){
        prevWrappers[pw].style.removeProperty('background');
        prevWrappers[pw].style.removeProperty('background-image');
        prevWrappers[pw].removeAttribute('data-dojo-panel-bg');
      }
    }

    if(!hasFullLogin && document.body){
      var wrappers=document.querySelectorAll('body > div, body > main, main > div, #app > div, #root > div, .page, .panel-shell, .panel-wrap, .dashboard, .tab-content');
      for(var w=0;w<wrappers.length;w++){
        var wr=wrappers[w];
        if(!wr || wr.getAttribute('data-dojo-login-box')==='1' || wr.closest('[data-dojo-login-box="1"]')) continue;
        if(wr.matches('header, nav, .navbar, .topbar, .bank-card-wrap, .bank-card, .bank-face')) continue;
        var rect=wr.getBoundingClientRect();
        if(rect.width>=vw*0.80 && rect.height>=vh*0.30){
          var wcs=window.getComputedStyle(wr);
          if(wcs.backgroundColor && wcs.backgroundColor!=='rgba(0, 0, 0, 0)' && wcs.backgroundColor!=='transparent'){
            wr.setAttribute('data-dojo-panel-bg','1');
            wr.style.setProperty('background','transparent','important');
            wr.style.setProperty('background-image','none','important');
          }
        }
      }
    }
  }
  syncLoginAndPanelState();
  if(!window.__dojoLoginObserver){
    window.__dojoLoginObserver=true;
    var scheduled=false;
    var triggerSync=function(){
      if(scheduled)return;
      scheduled=true;
      requestAnimationFrame(function(){
        scheduled=false;
        syncLoginAndPanelState();
      });
    };
    window.addEventListener('hashchange', triggerSync);
    window.addEventListener('popstate', triggerSync);
    if(history.pushState){
      var origPush=history.pushState;
      history.pushState=function(){
        var r=origPush.apply(this,arguments);
        triggerSync();
        return r;
      };
    }
    if(history.replaceState){
      var origReplace=history.replaceState;
      history.replaceState=function(){
        var r=origReplace.apply(this,arguments);
        triggerSync();
        return r;
      };
    }
    if(typeof MutationObserver==='function' && document.body){
      var obs=new MutationObserver(triggerSync);
      obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
    }
  }
  if(window.scrollX!==0){window.scrollTo(0,window.scrollY);}
  if(!window.__dojoClipboardPatched && window.AndroidDojoBridge){
    window.__dojoClipboardPatched=true;
    try{
      if(!navigator.clipboard){
        navigator.clipboard={
          writeText:function(t){
            return window.AndroidDojoBridge.copyText(String(t||''))
              ? Promise.resolve()
              : Promise.reject(new Error('Clipboard unavailable'));
          }
        };
      }else if(typeof navigator.clipboard.writeText==='function'){
        var origWrite=navigator.clipboard.writeText.bind(navigator.clipboard);
        navigator.clipboard.writeText=function(t){
          return origWrite(t).catch(function(){
            if(window.AndroidDojoBridge.copyText(String(t||''))) return Promise.resolve();
            return Promise.reject(new Error('Clipboard failed'));
          });
        };
      }
    }catch(_){}
    if(typeof window.print==='function'){
      window.print=function(){
        window.AndroidDojoBridge.printPage();
      };
    }
  }
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

private class AndroidDojoBridge(
    private val context: Context,
    private val webViewProvider: () -> WebView?,
    private val onLoginScreenChanged: (Boolean) -> Unit,
    private val onAuthenticatedChanged: (Boolean) -> Unit,
    private val onError: (String) -> Unit
) {
    @JavascriptInterface
    fun setLoginScreenActive(active: Boolean) {
        val wv = webViewProvider()
        if (wv != null) {
            wv.post { onLoginScreenChanged(active) }
        } else {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                onLoginScreenChanged(active)
            }
        }
    }

    @JavascriptInterface
    fun setAuthenticatedState(authenticated: Boolean) {
        val wv = webViewProvider()
        if (wv != null) {
            wv.post { onAuthenticatedChanged(authenticated) }
        } else {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                onAuthenticatedChanged(authenticated)
            }
        }
    }

    @JavascriptInterface
    fun copyText(text: String?): Boolean {
        if (text.isNullOrEmpty()) return false
        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
        cm.setPrimaryClip(ClipData.newPlainText("arslan_dojo", text))
        return true
    }

    @JavascriptInterface
    fun saveDataUrlFile(dataUrl: String?, fileName: String?, mimeType: String?) {
        if (dataUrl.isNullOrBlank()) {
            onError("خطا در دریافت فایل خروجی")
            return
        }
        val ok = saveDataUriAndShare(context, dataUrl, fileName, mimeType)
        if (!ok) {
            onError("خطا در دریافت فایل خروجی")
        }
    }

    @JavascriptInterface
    fun printPage() {
        val wv = webViewProvider() ?: return
        wv.post {
            runCatching {
                val pm = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return@post
                val adapter = wv.createPrintDocumentAdapter("arsalan-dojo")
                pm.print("arsalan-dojo", adapter, PrintAttributes.Builder().build())
            }.onFailure {
                onError("امکان چاپ در این دستگاه وجود ندارد")
            }
        }
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
    onOpenMealPlan: () -> Unit = {},
    onOpenProgressDashboard: () -> Unit = {},
    onToast: (String) -> Unit
) {
    val scope = rememberCoroutineScope()

    var loadProgress by remember { mutableIntStateOf(0) }
    var canGoBack by remember { mutableStateOf(false) }
    var hasLoadError by remember { mutableStateOf(false) }
    var isLoginView by remember { mutableStateOf(false) }
    var isAuthenticated by remember { mutableStateOf(false) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    val purpleBackdropAlpha by animateFloatAsState(
        targetValue = if (isLoginView) 0f else 1f,
        animationSpec = tween(durationMillis = 250),
        label = "purple_backdrop_alpha"
    )

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
            val data = result.data
            val clipData = data?.clipData
            if (clipData != null && clipData.itemCount > 0) {
                Array(clipData.itemCount) { index -> clipData.getItemAt(index).uri }
            } else {
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
            }
        } else null
        filePathCallback?.onReceiveValue(uris)
        filePathCallback = null
    }

    BackHandler(enabled = canGoBack) {
        webViewRef?.goBack()
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_PAUSE || event == Lifecycle.Event.ON_STOP) {
                runCatching { CookieManager.getInstance().flush() }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            runCatching { CookieManager.getInstance().flush() }
            webViewRef?.destroy()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DojoCreamBot)
    ) {
        if (purpleBackdropAlpha > 0.01f) {
            LuxuryPurpleAmbientBackdrop(
                modifier = Modifier
                    .fillMaxSize()
                    .alpha(purpleBackdropAlpha)
            )
        }

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
                            clearCache(true)
                            overScrollMode = View.OVER_SCROLL_NEVER
                            isVerticalScrollBarEnabled = true
                            isHorizontalScrollBarEnabled = false
                            val webView = this
                            addJavascriptInterface(
                                AndroidDojoBridge(
                                    context = ctx,
                                    webViewProvider = { webViewRef },
                                    onLoginScreenChanged = { active -> isLoginView = active },
                                    onAuthenticatedChanged = { authed -> isAuthenticated = authed },
                                    onError = { msg -> scope.launch { onToast(msg) } }
                                ),
                                "AndroidDojoBridge"
                            )
                            CookieManager.getInstance().apply {
                                setAcceptCookie(true)
                                setAcceptThirdPartyCookies(webView, true)
                            }
                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            allowContentAccess = true
                            cacheMode = WebSettings.LOAD_DEFAULT
                            loadsImagesAutomatically = true
                            useWideViewPort = false
                            loadWithOverviewMode = false
                            setSupportZoom(false)
                            builtInZoomControls = false
                            displayZoomControls = false
                            textZoom = 100
                            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
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
                                isLoginView = isLoginRouteUrl(url)
                            }

                            override fun onPageCommitVisible(view: WebView?, url: String?) {
                                isLoginView = isLoginRouteUrl(url)
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
                                if (scheme == "intent") {
                                    runCatching {
                                        val intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                                        ctx.startActivity(intent)
                                    }.onFailure {
                                        onToast("برنامه‌ای برای باز کردن این لینک یافت نشد")
                                    }
                                    return true
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
                            val guessedName = URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType)
                            when {
                                downloadUrl.startsWith("blob:", ignoreCase = true) -> {
                                    val escapedUrl = org.json.JSONObject.quote(downloadUrl)
                                    val escapedName = org.json.JSONObject.quote(guessedName)
                                    val escapedMime = org.json.JSONObject.quote(mimeType ?: "")
                                    webView.evaluateJavascript(
                                        """
                                        (function(){
                                          fetch($escapedUrl)
                                            .then(function(r){ return r.blob(); })
                                            .then(function(b){
                                              var reader=new FileReader();
                                              reader.onloadend=function(){
                                                if(window.AndroidDojoBridge){
                                                  window.AndroidDojoBridge.saveDataUrlFile(reader.result, $escapedName, b.type || $escapedMime);
                                                }
                                              };
                                              reader.readAsDataURL(b);
                                            })
                                            .catch(function(){
                                              if(window.AndroidDojoBridge){
                                                window.AndroidDojoBridge.saveDataUrlFile('', $escapedName, $escapedMime);
                                              }
                                            });
                                        })();
                                        """.trimIndent(),
                                        null
                                    )
                                }
                                downloadUrl.startsWith("data:", ignoreCase = true) -> {
                                    scope.launch(Dispatchers.IO) {
                                        val shared = saveDataUriAndShare(ctx, downloadUrl, guessedName, mimeType)
                                        if (!shared) {
                                            withContext(Dispatchers.Main) {
                                                onToast("خطا در دریافت فایل خروجی")
                                            }
                                        }
                                    }
                                }
                                else -> {
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

        AnimatedVisibility(
            visible = isAuthenticated && !hasLoadError,
            enter = fadeIn(tween(220)) + scaleIn(initialScale = 0.92f, animationSpec = tween(220)),
            exit = fadeOut(tween(180)) + scaleOut(targetScale = 0.92f, animationSpec = tween(180)),
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp, end = 16.dp, bottom = 16.dp)
        ) {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        onClick = onOpenMealPlan,
                        modifier = Modifier
                            .height(48.dp)
                            .testTag("open_meal_plan_btn"),
                        shape = RoundedCornerShape(24.dp),
                        color = DojoPurpleRoyal,
                        contentColor = Color.White,
                        shadowElevation = 8.dp,
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.35f))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.RestaurantMenu,
                                contentDescription = stringResource(R.string.meal_plan_fab_label),
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = stringResource(R.string.meal_plan_fab_label),
                                style = MaterialTheme.typography.labelLarge
                            )
                        }
                    }

                    Surface(
                        onClick = onOpenProgressDashboard,
                        modifier = Modifier
                            .height(48.dp)
                            .testTag("open_progress_dashboard_btn"),
                        shape = RoundedCornerShape(24.dp),
                        color = DojoGlassCardFrost,
                        contentColor = DojoPurpleImperial,
                        shadowElevation = 8.dp,
                        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ShowChart,
                                contentDescription = stringResource(R.string.progress_fab_label),
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = stringResource(R.string.progress_fab_label),
                                style = MaterialTheme.typography.labelLarge
                            )
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
internal fun LuxuryPurpleAmbientBackdrop(modifier: Modifier = Modifier) {
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

        // Upper-left rich imperial royal-purple luminous glow
        val topLeftLight = Offset(
            x = size.width * (0.14f + driftPrimary * 0.8f),
            y = size.height * (0.18f - driftSecondary * 0.6f)
        )
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    DojoPurpleImperial.copy(alpha = 0.54f),
                    DojoPurpleRoyal.copy(alpha = 0.36f),
                    DojoPurpleOrchid.copy(alpha = 0.16f),
                    Color.Transparent
                ),
                center = topLeftLight,
                radius = maxDim * 0.56f
            ),
            radius = maxDim * 0.56f,
            center = topLeftLight
        )

        // Lower-right radiant royal-amethyst ambient light
        val bottomRightLight = Offset(
            x = size.width * (0.86f + driftSecondary * 0.8f),
            y = size.height * (0.76f + driftPrimary * 0.6f)
        )
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    DojoPurpleRoyal.copy(alpha = 0.52f),
                    DojoPurpleOrchid.copy(alpha = 0.32f),
                    DojoPurpleGlowSoft.copy(alpha = 0.14f),
                    Color.Transparent
                ),
                center = bottomRightLight,
                radius = maxDim * 0.58f
            ),
            radius = maxDim * 0.58f,
            center = bottomRightLight
        )

        // Center orchid-violet ambient light bloom behind glass panels
        val midCenter = Offset(
            x = size.width * (0.48f - driftPrimary * 0.5f),
            y = size.height * (0.48f + driftSecondary * 0.5f)
        )
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    DojoPurpleOrchid.copy(alpha = 0.28f),
                    DojoPurpleGlowSoft.copy(alpha = 0.16f),
                    Color.Transparent
                ),
                center = midCenter,
                radius = minDim * 0.92f
            ),
            radius = minDim * 0.92f,
            center = midCenter
        )

        // Subtle glass specular highlight without washing out the purple glow
        drawRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    Color.White.copy(alpha = 0.12f),
                    Color.Transparent,
                    Color.White.copy(alpha = 0.08f)
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

        shareExportedFile(context, target, mimeType ?: "text/csv", rawName)
        true
    }.getOrDefault(false)
}

private fun saveDataUriAndShare(
    context: Context,
    dataUrl: String,
    fileName: String?,
    mimeType: String?
): Boolean {
    return runCatching {
        val commaIndex = dataUrl.indexOf(',')
        if (commaIndex == -1) return false
        val header = dataUrl.substring(5, commaIndex)
        val payload = dataUrl.substring(commaIndex + 1)
        val resolvedMime = mimeType?.takeIf { it.isNotBlank() }
            ?: header.substringBefore(';').takeIf { it.contains('/') }
            ?: "application/octet-stream"
        val bytes = if (header.contains(";base64", ignoreCase = true)) {
            Base64.decode(payload, Base64.DEFAULT)
        } else {
            Uri.decode(payload).toByteArray(Charsets.UTF_8)
        }
        val safeName = (fileName ?: "arslan-dojo-export")
            .replace(Regex("[^a-zA-Z0-9._-]"), "_")
            .ifBlank { "arslan-dojo-export" }
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val target = File(dir, safeName)
        target.writeBytes(bytes)
        shareExportedFile(context, target, resolvedMime, safeName)
        true
    }.getOrDefault(false)
}

private fun shareExportedFile(
    context: Context,
    target: File,
    mimeType: String,
    displayName: String
) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", target)
    android.os.Handler(android.os.Looper.getMainLooper()).post {
        val share = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(
            Intent.createChooser(share, displayName).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }
}
