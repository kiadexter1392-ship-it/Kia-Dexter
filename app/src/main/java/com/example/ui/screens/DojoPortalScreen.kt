package com.example.ui.screens

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import com.example.ui.components.CardSectionHeader
import com.example.ui.components.DisciplineCardSwap
import com.example.ui.components.DojoBackground
import com.example.ui.components.DojoEnsoLogo
import com.example.ui.components.DojoGhostButton
import com.example.ui.components.DojoGlassCard
import com.example.ui.components.DojoPrimaryButton
import com.example.ui.components.DojoSubCard
import com.example.ui.components.FlipBankCard
import com.example.ui.components.TuitionCardStack
import com.example.ui.theme.DojoGlassSurface
import com.example.ui.theme.DojoGold
import com.example.ui.theme.DojoGoldDark
import com.example.ui.theme.DojoGoldSoft
import com.example.ui.theme.DojoInk
import com.example.ui.theme.DojoMuted
import com.example.ui.theme.DojoTextLight
import com.example.util.DojoConstants
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

private const val MEMBERS_BASE_URL = "http://arsalan.up.railway.app/"
private const val COACH_BASE_URL = "http://arsalan.up.railway.app/coach/"

enum class PortalTab(val label: String, val icon: ImageVector) {
    MEMBERS("سایت شاگردان", Icons.Default.Public),
    COACH("پنل مربی", Icons.Default.AdminPanelSettings),
    INFO("شهریه و تماس", Icons.Default.CreditCard)
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun DojoPortalScreen(
    onToast: (String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var activeTab by remember { mutableStateOf(PortalTab.MEMBERS) }
    var loadProgress by remember { mutableIntStateOf(0) }
    var canGoBack by remember { mutableStateOf(false) }
    var hasLoadError by remember { mutableStateOf(false) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = if (result.resultCode == Activity.RESULT_OK) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        } else null
        filePathCallback?.onReceiveValue(uris)
        filePathCallback = null
    }

    BackHandler(enabled = activeTab == PortalTab.INFO || canGoBack) {
        if (activeTab == PortalTab.INFO) {
            activeTab = PortalTab.MEMBERS
        } else {
            webViewRef?.goBack()
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            CookieManager.getInstance().flush()
            webViewRef?.destroy()
        }
    }

    DojoBackground {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val useRail = maxWidth >= 640.dp
            Row(modifier = Modifier.fillMaxSize()) {
                if (useRail) {
                    NavigationRail(
                        containerColor = DojoGlassSurface,
                        modifier = Modifier
                            .fillMaxHeight()
                            .windowInsetsPadding(WindowInsets.safeDrawing)
                    ) {
                        Spacer(modifier = Modifier.height(12.dp))
                        PortalTab.entries.forEach { tab ->
                            NavigationRailItem(
                                selected = activeTab == tab,
                                onClick = {
                                    activeTab = tab
                                    when (tab) {
                                        PortalTab.MEMBERS -> {
                                            hasLoadError = false
                                            webViewRef?.loadUrl(MEMBERS_BASE_URL)
                                        }
                                        PortalTab.COACH -> {
                                            hasLoadError = false
                                            webViewRef?.loadUrl(COACH_BASE_URL)
                                        }
                                        PortalTab.INFO -> Unit
                                    }
                                },
                                icon = { Icon(tab.icon, contentDescription = tab.label) },
                                label = { Text(tab.label, maxLines = 1) },
                                colors = NavigationRailItemDefaults.colors(
                                    selectedIconColor = DojoGoldDark,
                                    selectedTextColor = DojoGoldDark,
                                    indicatorColor = DojoGoldSoft
                                )
                            )
                        }
                    }
                }

                Scaffold(
                    containerColor = Color.Transparent,
                    contentWindowInsets = WindowInsets.safeDrawing,
                    topBar = {
                        Column {
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                color = DojoGlassSurface,
                                shadowElevation = 1.dp
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        DojoEnsoLogo(size = 34.dp)
                                        Column {
                                            Text(
                                                text = DojoConstants.CLUB_NAME,
                                                style = MaterialTheme.typography.titleMedium,
                                                color = DojoInk,
                                                fontWeight = FontWeight.Bold
                                            )
                                            Text(
                                                text = activeTab.label,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = DojoGoldDark
                                            )
                                        }
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        if (activeTab != PortalTab.INFO && canGoBack) {
                                            IconButton(
                                                onClick = { webViewRef?.goBack() },
                                                modifier = Modifier.testTag("portal_back_btn")
                                            ) {
                                                Icon(
                                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                                    contentDescription = "بازگشت",
                                                    tint = DojoInk
                                                )
                                            }
                                        }
                                        if (activeTab != PortalTab.INFO) {
                                            IconButton(
                                                onClick = {
                                                    hasLoadError = false
                                                    webViewRef?.reload()
                                                },
                                                modifier = Modifier.testTag("portal_reload_btn")
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Refresh,
                                                    contentDescription = "بارگذاری مجدد",
                                                    tint = DojoGoldDark
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                            if (activeTab != PortalTab.INFO && loadProgress in 1..99) {
                                LinearProgressIndicator(
                                    progress = { loadProgress / 100f },
                                    modifier = Modifier.fillMaxWidth(),
                                    color = DojoGold,
                                    trackColor = DojoGoldSoft
                                )
                            }
                        }
                    },
                    bottomBar = {
                        if (!useRail) {
                            NavigationBar(containerColor = DojoGlassSurface) {
                                PortalTab.entries.forEach { tab ->
                                    NavigationBarItem(
                                        selected = activeTab == tab,
                                        onClick = {
                                            activeTab = tab
                                            when (tab) {
                                                PortalTab.MEMBERS -> {
                                                    hasLoadError = false
                                                    webViewRef?.loadUrl(MEMBERS_BASE_URL)
                                                }
                                                PortalTab.COACH -> {
                                                    hasLoadError = false
                                                    webViewRef?.loadUrl(COACH_BASE_URL)
                                                }
                                                PortalTab.INFO -> Unit
                                            }
                                        },
                                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                                        label = { Text(tab.label, maxLines = 1) },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = DojoGoldDark,
                                            selectedTextColor = DojoGoldDark,
                                            indicatorColor = DojoGoldSoft
                                        )
                                    )
                                }
                            }
                        }
                    }
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        // Keep WebView mounted so navigation state and session remain alive
                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { ctx ->
                                WebView(ctx).apply {
                                    layoutParams = ViewGroup.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                    val webView = this
                                    CookieManager.getInstance().apply {
                                        setAcceptCookie(true)
                                        setAcceptThirdPartyCookies(webView, true)
                                    }
                                    settings.apply {
                                        javaScriptEnabled = true
                                        domStorageEnabled = true
                                        databaseEnabled = true
                                        loadsImagesAutomatically = true
                                        useWideViewPort = true
                                        loadWithOverviewMode = true
                                        setSupportZoom(false)
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
                                        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                            hasLoadError = false
                                            canGoBack = view?.canGoBack() == true
                                            if (url != null && activeTab != PortalTab.INFO) {
                                                activeTab = if (url.contains("/coach")) PortalTab.COACH else PortalTab.MEMBERS
                                            }
                                        }

                                        override fun onPageFinished(view: WebView?, url: String?) {
                                            canGoBack = view?.canGoBack() == true
                                            CookieManager.getInstance().flush()
                                        }

                                        override fun shouldOverrideUrlLoading(
                                            view: WebView?,
                                            request: WebResourceRequest?
                                        ): Boolean {
                                            val uri = request?.url ?: return false
                                            val urlStr = uri.toString()
                                            val scheme = uri.scheme?.lowercase() ?: ""
                                            if (scheme == "tel" || scheme == "mailto" || scheme == "sms") {
                                                runCatching { ctx.startActivity(Intent(Intent.ACTION_DIAL.takeIf { scheme == "tel" } ?: Intent.ACTION_VIEW, uri)) }
                                                return true
                                            }
                                            val host = uri.host?.lowercase() ?: ""
                                            return if (host == "arsalan.up.railway.app") {
                                                false
                                            } else {
                                                runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                                                true
                                            }
                                        }

                                        override fun onReceivedError(
                                            view: WebView?,
                                            request: WebResourceRequest?,
                                            error: WebResourceError?
                                        ) {
                                            if (request?.isForMainFrame == true) {
                                                hasLoadError = true
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

                                    loadUrl(MEMBERS_BASE_URL)
                                    webViewRef = this
                                }
                            }
                        )

                        if (activeTab != PortalTab.INFO && hasLoadError) {
                            Surface(
                                modifier = Modifier.fillMaxSize(),
                                color = MaterialTheme.colorScheme.background
                            ) {
                                Box(
                                    modifier = Modifier.fillMaxSize().padding(24.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    DojoGlassCard(
                                        modifier = Modifier.widthIn(max = 420.dp),
                                        amberTint = true
                                    ) {
                                        Column(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalAlignment = Alignment.CenterHorizontally
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.WifiOff,
                                                contentDescription = "عدم اتصال به اینترنت",
                                                tint = DojoGoldDark,
                                                modifier = Modifier.size(48.dp)
                                            )
                                            Spacer(modifier = Modifier.height(12.dp))
                                            Text(
                                                text = "اتصال به سرور ارسلان دوجو برقرار نشد",
                                                style = MaterialTheme.typography.titleMedium,
                                                fontWeight = FontWeight.Bold,
                                                color = DojoInk,
                                                textAlign = TextAlign.Center
                                            )
                                            Spacer(modifier = Modifier.height(6.dp))
                                            Text(
                                                text = "لطفاً اتصال اینترنت خود را بررسی کنید و دوباره تلاش نمایید.",
                                                style = MaterialTheme.typography.bodySmall,
                                                color = DojoMuted,
                                                textAlign = TextAlign.Center
                                            )
                                            Spacer(modifier = Modifier.height(16.dp))
                                            DojoPrimaryButton(
                                                text = "تلاش مجدد",
                                                onClick = {
                                                    hasLoadError = false
                                                    webViewRef?.reload()
                                                },
                                                modifier = Modifier.fillMaxWidth().testTag("portal_retry_btn")
                                            )
                                            Spacer(modifier = Modifier.height(8.dp))
                                            DojoGhostButton(
                                                text = "مشاهده شهریه و اطلاعات تماس",
                                                onClick = { activeTab = PortalTab.INFO },
                                                modifier = Modifier.fillMaxWidth()
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        if (activeTab == PortalTab.INFO) {
                            Surface(
                                modifier = Modifier.fillMaxSize(),
                                color = MaterialTheme.colorScheme.background
                            ) {
                                OfflineTuitionAndContactView(onCopied = onToast)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OfflineTuitionAndContactView(onCopied: (String) -> Unit) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Column(
            modifier = Modifier.widthIn(max = 680.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            DojoGlassCard(amberTint = true) {
                CardSectionHeader(title = "پرداخت شهریه ماهانه", dotColor = DojoGoldDark)
                Text(
                    text = "مهلت پرداخت شهریه تا دوازدهم هر ماه است. برای مشاهده شماره کارت و کپی آن، روی کارت ضربه بزنید.",
                    style = MaterialTheme.typography.bodySmall,
                    color = DojoTextLight
                )
                Spacer(modifier = Modifier.height(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    DojoConstants.TUITION_CARDS.forEach { card ->
                        FlipBankCard(card = card, onCopied = onCopied)
                    }
                }
            }

            DojoGlassCard {
                CardSectionHeader(title = "تعرفه رشته‌های باشگاه", dotColor = DojoGold)
                TuitionCardStack(pricing = DojoConstants.PRICING)
            }

            DisciplineCardSwap()

            DojoGlassCard {
                CardSectionHeader(title = "تماس و آدرس باشگاه", dotColor = DojoGold)
                DojoSubCard(padding = 12.dp) {
                    Text(DojoConstants.ADDRESS, style = MaterialTheme.typography.bodyMedium, color = DojoInk)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(DojoConstants.WORKING_HOURS, style = MaterialTheme.typography.bodySmall, color = DojoMuted)
                }
                Spacer(modifier = Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DojoPrimaryButton(
                        text = "تماس تلفنی",
                        onClick = {
                            runCatching {
                                context.startActivity(
                                    Intent(Intent.ACTION_DIAL, Uri.parse("tel:${DojoConstants.SUPPORT_PHONE}"))
                                )
                            }
                        },
                        modifier = Modifier.weight(1f).testTag("info_dial_btn")
                    )
                    DojoGhostButton(
                        text = "پیام در بله",
                        onClick = {
                            runCatching {
                                context.startActivity(
                                    Intent(Intent.ACTION_VIEW, Uri.parse(DojoConstants.BALE_LINK))
                                )
                            }
                        },
                        modifier = Modifier.weight(1f).testTag("info_bale_btn")
                    )
                }
            }
        }
    }
}

private suspend fun downloadAndShareFile(
    context: android.content.Context,
    url: String,
    contentDisposition: String?,
    mimeType: String?
): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = true
            CookieManager.getInstance().getCookie(url)?.let { cookie ->
                setRequestProperty("Cookie", cookie)
            }
        }
        val rawName = contentDisposition
            ?.substringAfter("filename=", "")
            ?.trim('"', ' ', ';')
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
