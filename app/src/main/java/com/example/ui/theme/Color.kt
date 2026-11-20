package com.example.ui.theme

import androidx.compose.ui.graphics.Color

val DojoGold = Color(0xFFD4A853)
val DojoGoldLight = Color(0xFFE8C878)
val DojoGoldDark = Color(0xFFB38834)
val DojoGoldSoft = Color(0x26D4A853)
val DojoAmberGlass = Color(0x2ED4A853)
val DojoAmberBorder = Color(0x4DD4A853)

val DojoCreamTop = Color(0xFFF5F3EE)
val DojoCreamMid = Color(0xFFE8E4DB)
val DojoCreamBot = Color(0xFFF0EDE6)
val DojoGlassSurface = Color(0xD9FFFFFF)
val DojoGlassSubtle = Color(0x88FFFFFF)
val DojoGlassBorder = Color(0x33D4A853)
val DojoLineSoft = Color(0x12000000)

// Rich royal purple ambient light & frosted glass tokens
val DojoGlassCanvasTop = Color(0xFFF3EBFF)
val DojoGlassCanvasMid = Color(0xFFE9D8FD)
val DojoGlassCanvasBot = Color(0xFFF1E6FF)
val DojoPurpleRoyal = Color(0xFF6D28D9)
val DojoPurpleImperial = Color(0xFF4C1D95)
val DojoPurpleOrchid = Color(0xFFA855F7)
val DojoPurpleGlowSoft = Color(0xFFC084FC)
val DojoGlassCardFrost = Color(0xB8FFFFFF)
val DojoPurpleBorderGlow = Color(0x4D7C3AED)

val DojoInk = Color(0xFF1A1A2E)
val DojoTextLight = Color(0xFF444444)
val DojoMuted = Color(0xFF777777)
val DojoMutedLight = Color(0xFF999999)

val DojoRed = Color(0xFFE74C3C)
val DojoRedSoft = Color(0x1FE74C3C)
val DojoGreen = Color(0xFF27AE60)
val DojoGreenSoft = Color(0x1F27AE60)
val DojoBlue = Color(0xFF3498DB)
val DojoBlueSoft = Color(0x1F3498DB)
val DojoAmber = Color(0xFFE8A840)

// StackedBars segment colors matching shell.css
val ChartEndurance = Color(0xFF3498DB)
val ChartStrength = Color(0xFFE74C3C)
val ChartTechnique = Color(0xFFD4A853)
val ChartFlexibility = Color(0xFF27AE60)
val ChartSessions = Color(0xFF8E7CC3)

// Macro-nutrient chart colors
val MacroProteinColor = Color(0xFF6D28D9)
val MacroProteinGlow = Color(0xFFA855F7)
val MacroCarbsColor = Color(0xFFD97706)
val MacroCarbsGlow = Color(0xFFF59E0B)
val MacroFatColor = Color(0xFF0284C7)
val MacroFatGlow = Color(0xFF38BDF8)

fun parseHexColor(hex: String?, fallback: Color = DojoGold): Color {
    if (hex.isNullOrBlank()) return fallback
    return try {
        val clean = hex.trim().removePrefix("#")
        val value = clean.toLong(16)
        when (clean.length) {
            6 -> Color(0xFF000000 or value)
            8 -> Color(value)
            else -> fallback
        }
    } catch (_: Exception) {
        fallback
    }
}

fun heatColor(score: Int?): Color = when {
    score == null -> DojoMutedLight
    score < 40 -> DojoRed
    score < 60 -> DojoAmber
    score < 80 -> DojoGoldDark
    else -> DojoGreen
}
