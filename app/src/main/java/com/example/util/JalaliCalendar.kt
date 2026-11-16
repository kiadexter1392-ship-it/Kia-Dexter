package com.example.util

import java.util.Calendar
import java.util.Date
import java.util.TimeZone
import kotlin.math.floor

data class JalaliDate(val jy: Int, val jm: Int, val jd: Int)

object JalaliCalendar {
    val MONTHS = listOf(
        "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    )

    val MONTHS_SHORT = listOf(
        "فرو", "ارد", "خرد", "تیر", "مرد", "شهر",
        "مهر", "آبا", "آذر", "دی", "بهم", "اسف"
    )

    val WEEKDAYS = listOf("شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه")

    private val BREAKS = intArrayOf(
        -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
        1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
    )

    private val FA_DIGITS = charArrayOf('۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹')
    private val AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"

    private data class JalCalResult(val leap: Int, val gy: Int, val march: Int)
    private data class GregDate(val gy: Int, val gm: Int, val gd: Int)

    private fun div(a: Int, b: Int): Int = a / b
    private fun mod(a: Int, b: Int): Int = a - (a / b) * b

    private fun jalCal(jy: Int): JalCalResult {
        val bl = BREAKS.size
        val gy = jy + 621
        var leapJ = -14
        var jp = BREAKS[0]
        var jump = 0
        require(jy >= jp && jy < BREAKS[bl - 1]) { "سال شمسی نامعتبر: $jy" }
        for (i in 1 until bl) {
            val jm = BREAKS[i]
            jump = jm - jp
            if (jy < jm) break
            leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4)
            jp = jm
        }
        var n = jy - jp
        leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
        if (mod(jump, 33) == 4 && jump - n == 4) leapJ += 1
        val leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
        val march = 20 + leapJ - leapG
        if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
        var leap = mod(mod(n + 1, 33) - 1, 4)
        if (leap == -1) leap = 4
        return JalCalResult(leap, gy, march)
    }

    private fun g2d(gy: Int, gm: Int, gd: Int): Int {
        var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
            div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408
        d -= div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) - 752
        return d
    }

    private fun d2g(jdn: Int): GregDate {
        var j = 4 * jdn + 139361631
        j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
        val i = div(mod(j, 1461), 4) * 5 + 308
        val gd = div(mod(i, 153), 5) + 1
        val gm = mod(div(i, 153), 12) + 1
        val gy = div(j, 1461) - 100100 + div(8 - gm, 6)
        return GregDate(gy, gm, gd)
    }

    private fun j2d(jy: Int, jm: Int, jd: Int): Int {
        val r = jalCal(jy)
        return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
    }

    private fun d2j(jdn: Int): JalaliDate {
        val gy = d2g(jdn).gy
        var jy = gy - 621
        val r = jalCal(jy)
        val jdn1f = g2d(gy, 3, r.march)
        var k = jdn - jdn1f
        if (k >= 0) {
            if (k <= 185) {
                return JalaliDate(jy, 1 + div(k, 31), mod(k, 31) + 1)
            }
            k -= 186
        } else {
            jy -= 1
            k += 179
            if (r.leap == 1) k += 1
        }
        return JalaliDate(jy, 7 + div(k, 30), mod(k, 30) + 1)
    }

    fun toJalali(millis: Long = System.currentTimeMillis()): JalaliDate {
        val cal = Calendar.getInstance()
        cal.timeInMillis = millis
        return d2j(g2d(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH)))
    }

    fun toJalaliFromIso(iso: String?): JalaliDate? {
        if (iso.isNullOrBlank()) return null
        val millis = parseIsoMillis(iso) ?: return null
        return toJalali(millis)
    }

    fun toGregorianIso(jy: Int, jm: Int, jd: Int): String {
        val g = d2g(j2d(jy, jm, jd))
        return "%04d-%02d-%02d".format(g.gy, g.gm, g.gd)
    }

    fun isJalaliLeap(jy: Int): Boolean = jalCal(jy).leap == 0

    fun jalaliMonthLength(jy: Int, jm: Int): Int {
        if (jm <= 6) return 31
        if (jm <= 11) return 30
        return if (isJalaliLeap(jy)) 30 else 29
    }

    fun todayJalali(): JalaliDate = toJalali(System.currentTimeMillis())

    fun faNum(input: Any?): String {
        if (input == null) return ""
        val s = input.toString()
        val sb = StringBuilder(s.length)
        for (ch in s) {
            if (ch in '0'..'9') sb.append(FA_DIGITS[ch - '0']) else sb.append(ch)
        }
        return sb.toString()
    }

    fun enNum(input: String?): String {
        if (input == null) return ""
        val sb = StringBuilder(input.length)
        for (ch in input) {
            val faIdx = FA_DIGITS.indexOf(ch)
            val arIdx = AR_DIGITS.indexOf(ch)
            when {
                faIdx >= 0 -> sb.append(('0'.code + faIdx).toChar())
                arIdx >= 0 -> sb.append(('0'.code + arIdx).toChar())
                else -> sb.append(ch)
            }
        }
        return sb.toString()
    }

    fun formatJalali(millis: Long = System.currentTimeMillis(), withTime: Boolean = false): String {
        val cal = Calendar.getInstance()
        cal.timeInMillis = millis
        val j = toJalali(millis)
        val base = "${faNum(j.jd)} ${MONTHS[j.jm - 1]} ${faNum(j.jy)}"
        if (!withTime) return base
        val hh = "%02d".format(cal.get(Calendar.HOUR_OF_DAY))
        val mm = "%02d".format(cal.get(Calendar.MINUTE))
        return "$base — ${faNum("$hh:$mm")}"
    }

    fun formatJalaliShort(millis: Long): String {
        val j = toJalali(millis)
        return faNum("%d/%02d/%02d".format(j.jy, j.jm, j.jd))
    }

    fun formatIsoShort(iso: String?): String {
        val millis = parseIsoMillis(iso) ?: return "—"
        return formatJalaliShort(millis)
    }

    fun formatIsoFull(iso: String?, withTime: Boolean = false): String {
        val millis = parseIsoMillis(iso) ?: return "—"
        return formatJalali(millis, withTime)
    }

    fun timeAgo(millis: Long): String {
        val diff = (System.currentTimeMillis() - millis).coerceAtLeast(0L)
        val m = diff / 60000L
        if (m < 1) return "همین حالا"
        if (m < 60) return "${faNum(m)} دقیقه پیش"
        val h = m / 60L
        if (h < 24) return "${faNum(h)} ساعت پیش"
        val d = h / 24L
        if (d < 30) return "${faNum(d)} روز پیش"
        return formatJalaliShort(millis)
    }

    fun timeAgoIso(iso: String?): String {
        val millis = parseIsoMillis(iso) ?: return "—"
        return timeAgo(millis)
    }

    fun nowIso(): String {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        return "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ".format(
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH),
            cal.get(Calendar.HOUR_OF_DAY),
            cal.get(Calendar.MINUTE),
            cal.get(Calendar.SECOND),
            cal.get(Calendar.MILLISECOND)
        )
    }

    fun todayDateIso(): String {
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        return "%04d-%02d-%02d".format(
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )
    }

    fun parseIsoMillis(iso: String?): Long? {
        if (iso.isNullOrBlank()) return null
        return try {
            val trimmed = iso.trim()
            val datePart = trimmed.substring(0, 10)
            val parts = datePart.split("-").map { it.toInt() }
            val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
            if (trimmed.length >= 19 && trimmed[10] == 'T') {
                val timePart = trimmed.substring(11, 19).split(":").map { it.toInt() }
                cal.set(parts[0], parts[1] - 1, parts[2], timePart[0], timePart[1], timePart[2])
            } else {
                cal.set(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
            }
            cal.set(Calendar.MILLISECOND, 0)
            cal.timeInMillis
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Port of shared/member-details.js normalizeMemberDetails for birth_date.
     * Accepts Jalali (e.g. 1390/05/21 or ۱۳۹۰/۰۵/۲۱) or Gregorian YYYY-MM-DD,
     * returns normalized ISO date YYYY-MM-DD or null. Throws IllegalArgumentException on invalid input.
     */
    fun normalizeBirthDate(input: String?): String? {
        val raw = enNum(input?.trim()).trim()
        if (raw.isEmpty()) return null
        val regex = Regex("""^\d{4}[/-]\d{1,2}[/-]\d{1,2}$""")
        if (!regex.matches(raw)) {
            throw IllegalArgumentException("تاریخ تولد را کامل وارد کنید؛ مانند ۱۳۹۰/۰۵/۲۱")
        }
        val parts = raw.split(Regex("[/-]")).map { it.toInt() }
        var year = parts[0]
        var month = parts[1]
        var day = parts[2]
        if (year in 1200..1600) {
            if (month !in 1..12 || day < 1 || day > jalaliMonthLength(year, month)) {
                throw IllegalArgumentException("تاریخ تولد معتبر نیست")
            }
            val iso = toGregorianIso(year, month, day)
            val gParts = iso.split("-").map { it.toInt() }
            year = gParts[0]
            month = gParts[1]
            day = gParts[2]
        }
        if (year !in 1800..2200 || month !in 1..12 || day !in 1..31) {
            throw IllegalArgumentException("تاریخ تولد معتبر نیست")
        }
        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        cal.isLenient = false
        try {
            cal.set(year, month - 1, day, 0, 0, 0)
            cal.set(Calendar.MILLISECOND, 0)
            cal.timeInMillis
        } catch (_: Exception) {
            throw IllegalArgumentException("تاریخ تولد معتبر نیست")
        }
        val iso = "%04d-%02d-%02d".format(year, month, day)
        if (iso > todayDateIso()) {
            throw IllegalArgumentException("تاریخ تولد نمی‌تواند در آینده باشد")
        }
        return iso
    }

    fun birthDateToJalaliDisplay(iso: String?): String {
        val j = toJalaliFromIso(iso) ?: return ""
        return "%d/%02d/%02d".format(j.jy, j.jm, j.jd)
    }

    fun formatNumberComma(value: Int): String {
        val raw = "%,d".format(value)
        return faNum(raw)
    }
}
