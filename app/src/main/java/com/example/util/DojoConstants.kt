package com.example.util

data class TuitionCard(
    val number: String,
    val formattedNumber: String,
    val holder: String,
    val label: String,
    val isMale: Boolean
)

data class DisciplinePricing(
    val discipline: String,
    val price: String,
    val priceNum: Int
)

data class FaqItem(
    val question: String,
    val answer: String
)

data class MetricDef(
    val key: String,
    val label: String,
    val unit: String,
    val max: Int,
    val isScore: Boolean
)

object DojoConstants {
    const val CLUB_NAME = "باشگاه آنلاین ارسلان دوجو"
    const val CLUB_EN_NAME = "ARSLAN DOJO"
    const val ADDRESS = "خادم آباد، کوچه لاله چهارم غربی، جنب پلی استیشن فروشی."
    const val SUPPORT_PHONE = "+989016399804"
    const val SUPPORT_PHONE_DISPLAY = "+98 901 639 9804"
    const val BALE_LINK = "https://ble.ir/+989016399804"
    const val WORKING_HOURS = "شنبه تا چهارشنبه: ۱۶–۲۱\nپنجشنبه: ۹–۱۳"

    val BLOOD_GROUPS = listOf("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")

    val MEMBER_BELTS = listOf(
        "سفید", "زرد", "نارنجی", "سبز", "آبی", "قهوه‌ای", "مشکی دان ۱", "مشکی دان ۲"
    )

    val COACH_BELTS = listOf(
        "سفید", "زرد", "نارنجی", "سبز", "آبی", "قهوه‌ای",
        "مشکی دان ۱", "مشکی دان ۲", "مشکی دان ۳", "مشکی دان ۴"
    )

    val DISCIPLINES = listOf("کاراته", "کراسفیت", "بوکس", "ژیمناستیک", "موی تای")

    val PLAN_CATEGORIES = listOf("تمرین", "بدنسازی", "تکنیک", "کاتا", "مبارزه", "کشش و انعطاف")
    val PLAN_DIFFICULTIES = listOf("سبک", "متوسط", "سنگین")

    val ANNOUNCEMENT_CATEGORIES = listOf("عمومی", "کلاس‌ها", "آزمون", "رویداد", "تغییر برنامه", "تبریک")
    val SELF_REPORT_FEELINGS = listOf("عالی", "خوب", "متوسط", "خسته", "نیاز به برنامه سبک‌تر")

    val AVATAR_COLORS = listOf(
        "#e2483d", "#d9a441", "#3fa7d6", "#5cb85c", "#a06cd5", "#ef7f57", "#2fa8a0"
    )

    val METRICS = listOf(
        MetricDef("sessions", "جلسات تمرین", "جلسه", 31, false),
        MetricDef("endurance", "استقامت", "٪", 100, true),
        MetricDef("strength", "قدرت", "٪", 100, true),
        MetricDef("technique", "تکنیک", "٪", 100, true),
        MetricDef("flexibility", "انعطاف", "٪", 100, true),
        MetricDef("discipline", "انضباط", "٪", 100, true),
        MetricDef("weight_kg", "وزن", "کیلوگرم", 200, false),
        MetricDef("overall", "نمره کل", "٪", 100, true)
    )

    val TUITION_CARDS = listOf(
        TuitionCard(
            number = "6219861938986279",
            formattedNumber = "6219 8619 3898 6279",
            holder = "نوید احمدی",
            label = "شهریه آقایان",
            isMale = true
        ),
        TuitionCard(
            number = "6219861903417334",
            formattedNumber = "6219 8619 0341 7334",
            holder = "خانم توکلی شانجانی",
            label = "شهریه بانوان",
            isMale = false
        )
    )

    val PRICING = listOf(
        DisciplinePricing("کاراته جوانان و بزرگسالان", "۱,۹۰۰", 1900),
        DisciplinePricing("کاراته نونهالان", "۱,۸۰۰", 1800),
        DisciplinePricing("کراسفیت کودک", "۱,۸۰۰", 1800),
        DisciplinePricing("کراسفیت بزرگسالان و نوجوانان", "۱,۸۰۰", 1800),
        DisciplinePricing("بوکس", "۱,۸۰۰", 1800),
        DisciplinePricing("ژیمناستیک", "۱,۵۰۰", 1500),
        DisciplinePricing("موی تای بانوان", "۱,۵۰۰", 1500)
    )

    val FAQS = listOf(
        FaqItem(
            "شهریه ماهانه چقدر است؟",
            "کاراته جوانان و بزرگسالان: ۱,۹۰۰ هزار تومان — کاراته نونهالان: ۱,۸۰۰ هزار تومان — کراسفیت کودک: ۱,۸۰۰ هزار تومان — کراسفیت بزرگسالان و نوجوانان: ۱,۸۰۰ هزار تومان — بوکس: ۱,۸۰۰ هزار تومان — ژیمناستیک: ۱,۵۰۰ هزار تومان — موی تای بانوان: ۱,۵۰۰ هزار تومان. مهلت پرداخت تا ۱۲ هر ماه."
        ),
        FaqItem(
            "چطور می‌توانم آنلاین شهریه را پرداخت کنم؟",
            "برای پرداخت آنلاین شهریه، می‌توانید مبلغ مورد نظر را به شماره کارت ۶۲۱۹-۸۶۱۹-۳۸۹۸-۶۲۷۹ به نام نوید احمدی (مخصوص آقایان) یا شماره کارت ۶۲۱۹-۸۶۱۹-۰۳۴۱-۷۳۳۴ به نام خانم توکلی شانجانی (مخصوص بانوان) واریز کنید. پس از واریز، لطفاً فیش واریزی را از طریق پیام‌رسان بله به شماره +989016399804 ارسال نمایید."
        ),
        FaqItem(
            "ساعت کلاس‌های باشگاه چگونه است؟",
            "ساعت کلاس‌ها بسته به رشته و گروه سنی متفاوت است. کلاس بزرگسالان معمولاً شنبه و دوشنبه ساعت ۱۸ تا ۲۰ و کلاس نوجوانان یکشنبه و سه‌شنبه ساعت ۱۷ تا ۱۸:۳۰ برگزار می‌شود. برای اطلاع از ساعت دقیق کلاس رشته خود، از بخش پشتیبانی با ما تماس بگیرید."
        ),
        FaqItem(
            "آیا امکان ثبت‌نام آزمایشی (یک جلسه رایگان) وجود دارد؟",
            "بله، شما می‌توانید یک جلسه به عنوان مهمان در کلاس مورد نظر شرکت کنید تا با محیط باشگاه و سبک تمرین آشنا شوید. برای هماهنگی با بخش پشتیبانی از طریق بله به شماره +989016399804 پیام دهید."
        ),
        FaqItem(
            "مهلت پرداخت شهریه تا چه زمانی است؟",
            "مهلت پرداخت شهریه هر ماه تا دوازدهم همان ماه می‌باشد. لطفاً پس از واریز، فیش واریزی را حتماً ارسال نمایید تا نام شما در لیست حاضرین ثبت شود."
        ),
        FaqItem(
            "آیا امکان تغییر رشته وجود دارد؟",
            "بله، شما می‌توانید با هماهنگی مربی و اطلاع به بخش پشتیبانی، رشته ورزشی خود را تغییر دهید. برای این کار از طریق پیام‌رسان بله با ما در ارتباط باشید."
        ),
        FaqItem(
            "چگونه جدول پیشرفت من پر می‌شود؟",
            "جدول پیشرفت ماهانه توسط مربی و بر اساس عملکرد شما در تمرینات پر می‌شود. شاخص‌هایی مانند استقامت، قدرت، تکنیک، انعطاف و انضباط هر ماه ارزیابی و نمره‌دهی می‌شوند. شما همچنین می‌توانید خودارزیابی ماهانه ثبت کنید."
        ),
        FaqItem(
            "اگر تمرین را نتوانم به‌موقع انجام دهم چه کنم؟",
            "در صورت عدم امکان انجام تمرین در مهلت مقرر، می‌توانید از طریق یادداشت در پنل کاربری یا تماس با مربی از طریق بله، موضوع را اطلاع دهید. مربی می‌تواند مهلت را تمدید یا برنامه جایگزین ارائه دهد."
        )
    )

    fun statusLabel(status: String): String = when (status) {
        "doing" -> "در حال انجام"
        "done" -> "تکمیل شده"
        else -> "انجام نشده"
    }

    fun initials(name: String?): String {
        val parts = name.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        return when {
            parts.size > 1 -> parts[0].take(1) + parts[1].take(1)
            parts.size == 1 -> parts[0].take(2)
            else -> "؟"
        }
    }
}
