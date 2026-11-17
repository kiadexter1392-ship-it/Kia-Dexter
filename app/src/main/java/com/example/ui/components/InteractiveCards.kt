package com.example.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.example.R
import com.example.ui.theme.DojoAmberBorder
import com.example.ui.theme.DojoAmberGlass
import com.example.ui.theme.DojoGlassBorder
import com.example.ui.theme.DojoGlassSubtle
import com.example.ui.theme.DojoGold
import com.example.ui.theme.DojoGoldDark
import com.example.ui.theme.DojoGoldLight
import com.example.ui.theme.DojoGoldSoft
import com.example.ui.theme.DojoGreen
import com.example.ui.theme.DojoInk
import com.example.ui.theme.DojoMuted
import com.example.ui.theme.DojoTextLight
import com.example.util.DisciplinePricing
import com.example.util.DojoConstants
import com.example.util.JalaliCalendar
import com.example.util.TuitionCard
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Interactive 3D-flipping Tuition Bank Card (port of .bank-card-wrap in style.css / index.html)
 */
@Composable
fun FlipBankCard(
    card: TuitionCard,
    onCopied: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var flipped by remember { mutableStateOf(false) }
    var copiedRecently by remember { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    val rotation by animateFloatAsState(
        targetValue = if (flipped) 180f else 0f,
        animationSpec = spring(dampingRatio = 0.72f, stiffness = 260f),
        label = "bank_card_flip"
    )

    val bgColor = if (card.isMale) Color(0x36D4A853) else Color(0x45D4A853)
    val borderColor = if (card.isMale) DojoAmberBorder else Color(0x66D4A853)

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .height(190.dp)
            .graphicsLayer {
                rotationY = rotation
                cameraDistance = 12f * density
            }
            .clip(RoundedCornerShape(18.dp))
            .clickable { flipped = !flipped }
            .testTag("bank_card_${if (card.isMale) "male" else "female"}"),
        shape = RoundedCornerShape(18.dp),
        color = bgColor,
        border = BorderStroke(1.dp, borderColor),
        shadowElevation = 3.dp
    ) {
        if (rotation <= 90f) {
            // Front Face
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.linearGradient(
                            if (card.isMale) listOf(Color(0x2ED4A853), Color(0x52FFFFFF))
                            else listOf(Color(0x3CD4A853), Color(0x58FFFFFF))
                        )
                    )
                    .padding(20.dp)
            ) {
                // Chip
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .size(width = 40.dp, height = 28.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Brush.linearGradient(listOf(DojoGold, DojoGoldLight)))
                )
                Text(
                    text = DojoConstants.CLUB_EN_NAME,
                    modifier = Modifier.align(Alignment.TopEnd),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 2.sp,
                    color = DojoGoldDark.copy(alpha = 0.75f)
                )
                Column(
                    modifier = Modifier.align(Alignment.CenterStart),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = card.holder,
                        style = MaterialTheme.typography.titleLarge,
                        color = DojoInk
                    )
                    DojoBadge(text = card.label, tone = BadgeTone.GOLD)
                }
                Row(
                    modifier = Modifier.align(Alignment.BottomCenter),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.TouchApp,
                        contentDescription = null,
                        tint = DojoMuted,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        text = "برای مشاهده شماره کارت ضربه بزنید",
                        style = MaterialTheme.typography.labelSmall,
                        color = DojoMuted
                    )
                }
            }
        } else {
            // Back Face (un-mirrored via rotationY = 180f)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer { rotationY = 180f }
                    .background(Color(0xEBFAF7F0))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(34.dp)
                        .background(
                            Brush.horizontalGradient(listOf(DojoGold.copy(alpha = 0.45f), DojoGoldLight.copy(alpha = 0.45f)))
                        )
                )
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(start = 18.dp, end = 18.dp, top = 42.dp, bottom = 14.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "شماره کارت",
                        style = MaterialTheme.typography.labelSmall,
                        color = DojoMuted
                    )
                    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                        Text(
                            text = card.formattedNumber,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            letterSpacing = 2.sp,
                            color = DojoInk
                        )
                    }
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable {
                                clipboard.setText(AnnotatedString(card.number))
                                copiedRecently = true
                                onCopied("شماره کارت با موفقیت کپی شد")
                            }
                            .testTag("copy_card_${if (card.isMale) "male" else "female"}"),
                        color = if (copiedRecently) DojoGreen.copy(alpha = 0.18f) else DojoGoldSoft,
                        border = BorderStroke(1.dp, if (copiedRecently) DojoGreen else DojoAmberBorder),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = if (copiedRecently) Icons.Default.Check else Icons.Default.ContentCopy,
                                contentDescription = "کپی شماره کارت",
                                tint = if (copiedRecently) DojoGreen else DojoGoldDark,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (copiedRecently) "کپی شد" else "کپی شماره کارت",
                                color = if (copiedRecently) DojoGreen else DojoGoldDark,
                                style = MaterialTheme.typography.labelLarge
                            )
                        }
                    }
                    Text(
                        text = "${card.holder} — ${card.label}",
                        style = MaterialTheme.typography.labelSmall,
                        color = DojoMuted
                    )
                }
            }
        }
    }
}

/**
 * Interactive Tuition Pricing Stack (port of CardStack.js)
 */
@Composable
fun TuitionCardStack(
    pricing: List<DisciplinePricing> = DojoConstants.PRICING,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    var activeIdx by remember { mutableIntStateOf(0) }
    val cards = pricing.take(6)

    Column(modifier = modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        if (!expanded) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(210.dp)
                    .clickable { expanded = true },
                contentAlignment = Alignment.Center
            ) {
                cards.forEachIndexed { idx, item ->
                    val offsetIdx = (idx - activeIdx + cards.size) % cards.size
                    val yOffset = (offsetIdx * 8).dp
                    val scale = 1f - (offsetIdx * 0.04f)
                    val rot = (offsetIdx - 1) * 2.2f
                    Surface(
                        modifier = Modifier
                            .width(230.dp)
                            .height(165.dp)
                            .offset(y = yOffset)
                            .zIndex((cards.size - offsetIdx).toFloat())
                            .graphicsLayer {
                                scaleX = scale
                                scaleY = scale
                                rotationZ = rot
                            }
                            .clickable {
                                if (offsetIdx == 0) {
                                    activeIdx = (activeIdx + 1) % cards.size
                                } else {
                                    expanded = true
                                }
                            },
                        shape = RoundedCornerShape(18.dp),
                        color = Color(0xF5FCF9F2),
                        border = BorderStroke(1.dp, DojoAmberBorder),
                        shadowElevation = (6 - offsetIdx).coerceAtLeast(1).dp
                    ) {
                        Box(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                            Text(
                                text = JalaliCalendar.faNum(idx + 1),
                                style = MaterialTheme.typography.labelSmall,
                                color = DojoGold,
                                modifier = Modifier.align(Alignment.TopStart)
                            )
                            Column(
                                modifier = Modifier.align(Alignment.Center),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = item.discipline,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = DojoTextLight,
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = item.price,
                                    fontSize = 28.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = DojoGoldDark
                                )
                                Text(
                                    text = "هزار تومان / ماه",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = DojoMuted
                                )
                            }
                        }
                    }
                }
            }
            Text(
                text = "برای ورق زدن ضربه بزنید • مشاهده همه تعرفه‌ها",
                style = MaterialTheme.typography.labelSmall,
                color = DojoGoldDark,
                modifier = Modifier
                    .clickable { expanded = true }
                    .padding(6.dp)
            )
        } else {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                pricing.forEachIndexed { idx, item ->
                    Surface(
                        modifier = Modifier
                            .width(168.dp)
                            .height(148.dp)
                            .clickable { expanded = false },
                        shape = RoundedCornerShape(16.dp),
                        color = DojoAmberGlass,
                        border = BorderStroke(1.dp, DojoAmberBorder)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize().padding(14.dp),
                            verticalArrangement = Arrangement.SpaceBetween,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = JalaliCalendar.faNum(idx + 1),
                                style = MaterialTheme.typography.labelSmall,
                                color = DojoGoldDark,
                                modifier = Modifier.align(Alignment.Start)
                            )
                            Text(
                                text = item.discipline,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Bold,
                                color = DojoInk,
                                textAlign = TextAlign.Center,
                                maxLines = 2
                            )
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = item.price,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = DojoGoldDark
                                )
                                Text(
                                    text = "هزار تومان / ماه",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = DojoMuted
                                )
                            }
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "بستن نمای گسترده",
                style = MaterialTheme.typography.labelSmall,
                color = DojoMuted,
                modifier = Modifier.clickable { expanded = false }.padding(4.dp)
            )
        }
    }
}

/**
 * Interactive Discipline Photo Card Stack (port of CardSwap.js)
 */
@Composable
fun DisciplineCardSwap(modifier: Modifier = Modifier) {
    data class DisciplineCard(val title: String, val resId: Int)
    val cards = remember {
        listOf(
            DisciplineCard("کاراته", R.drawable.img_card_karate),
            DisciplineCard("کراسفیت", R.drawable.img_card_crossfit),
            DisciplineCard("بوکس", R.drawable.img_card_boxing),
            DisciplineCard("ژیمناستیک", R.drawable.img_card_gym)
        )
    }
    var frontIndex by remember { mutableIntStateOf(0) }

    DojoGlassCard(modifier = modifier.fillMaxWidth()) {
        CardSectionHeader(
            title = "رشته‌های باشگاه",
            dotColor = DojoGold,
            trailing = {
                Text(
                    text = "ضربه برای تعویض کارت",
                    style = MaterialTheme.typography.labelSmall,
                    color = DojoMuted
                )
            }
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(225.dp),
            contentAlignment = Alignment.Center
        ) {
            cards.forEachIndexed { idx, card ->
                val depth = (idx - frontIndex + cards.size) % cards.size
                val tx by animateFloatAsState(
                    targetValue = depth * 18f,
                    animationSpec = spring(dampingRatio = 0.78f, stiffness = 240f),
                    label = "swap_tx"
                )
                val ty by animateFloatAsState(
                    targetValue = -depth * 10f,
                    animationSpec = spring(dampingRatio = 0.78f, stiffness = 240f),
                    label = "swap_ty"
                )
                val scale by animateFloatAsState(
                    targetValue = 1f - depth * 0.055f,
                    animationSpec = spring(dampingRatio = 0.78f, stiffness = 240f),
                    label = "swap_scale"
                )
                Surface(
                    modifier = Modifier
                        .width(210.dp)
                        .height(190.dp)
                        .zIndex((cards.size - depth).toFloat())
                        .graphicsLayer {
                            translationX = tx * density
                            translationY = ty * density
                            scaleX = scale
                            scaleY = scale
                        }
                        .clip(RoundedCornerShape(16.dp))
                        .clickable {
                            frontIndex = (frontIndex + 1) % cards.size
                        },
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.5.dp, DojoGoldLight),
                    shadowElevation = (8 - depth * 2).coerceAtLeast(1).dp
                ) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        Image(
                            painter = painterResource(id = card.resId),
                            contentDescription = card.title,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(Color.Transparent, Color(0xCC1A1A2E))
                                    )
                                )
                        )
                        Row(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = card.title,
                                color = Color.White,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            DojoBadge(
                                text = "${JalaliCalendar.faNum(idx + 1)} / ${JalaliCalendar.faNum(cards.size)}",
                                tone = BadgeTone.GOLD
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 6-cell OneTimeCode input (port of OneTimeCode.js)
 */
@Composable
fun OneTimeCodeInput(
    value: String,
    onValueChange: (String) -> Unit,
    length: Int = 6,
    modifier: Modifier = Modifier
) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BasicTextField(
            value = value,
            onValueChange = { raw ->
                val digits = JalaliCalendar.enNum(raw).filter { it.isDigit() }.take(length)
                onValueChange(digits)
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            textStyle = TextStyle(color = Color.Transparent),
            decorationBox = {
                Row(
                    modifier = modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)
                ) {
                    for (i in 0 until length) {
                        val char = value.getOrNull(i)
                        val isFocused = value.length == i
                        Box(
                            modifier = Modifier
                                .size(width = 42.dp, height = 50.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xD9FFFFFF))
                                .border(
                                    width = if (isFocused) 1.8.dp else 1.dp,
                                    color = if (isFocused) DojoGold else DojoAmberBorder,
                                    shape = RoundedCornerShape(10.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = char?.toString() ?: "",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = DojoInk
                            )
                        }
                    }
                }
            }
        )
    }
}
