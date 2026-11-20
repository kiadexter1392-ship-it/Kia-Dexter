const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_uid_123";
const BOB_UID = "bob_uid_456";

const [emulatorHost, emulatorPortStr] = (
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085"
).split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

function validProfilePayload(uid, ts) {
  return {
    userId: uid,
    displayName: "Kia User",
    email: "kia@example.com",
    goal: "افزایش حجم و عضله‌سازی",
    mealCount: 4,
    bodyStats: "وزن 75 کیلو، قد 178",
    preferredFoods: "تخم‌مرغ، مرغ، برنج",
    restrictions: "",
    extraNotes: "پرپروتئین و کم‌چرب",
    createdAt: ts,
    updatedAt: ts,
  };
}

function validMealPlanPayload(uid, ts) {
  return {
    userId: uid,
    goal: "افزایش حجم و عضله‌سازی",
    mealCount: 3,
    planTitle: "برنامه روزانه عضله‌سازی",
    summary: "تغذیه متعادل برای تمرین رزمی",
    dailyCalories: 2400,
    proteinTarget: "160 گرم",
    carbsTarget: "260 گرم",
    fatTarget: "70 گرم",
    hydrationTip: "حداقل 8 لیوان آب بنوشید.",
    coachTip: "پروتئین را در وعده‌های روز تقسیم کنید.",
    meals: [
      {
        mealTitle: "صبحانه",
        timeRange: "۸:۰۰",
        foods: ["۳ عدد تخم‌مرغ آب‌پز", "۲ کف دست نان سنگک"],
        calories: 550,
        proteinGrams: 35,
        carbsGrams: 55,
        fatGrams: 18,
        notes: "همراه سبزیجات تازه",
      },
    ],
    createdAt: ts,
    updatedAt: ts,
  };
}

function validProgressLogPayload(uid, ts) {
  return {
    userId: uid,
    category: "WORKOUT",
    title: "تمرین کاراته و کاتا",
    durationMinutes: 60,
    readinessScore: 86,
    weightTenthsKg: 745,
    sessionDateIso: "2026-11-19",
    notes: "تمرین عالی با تمرکز بالا",
    createdAt: ts,
    updatedAt: ts,
  };
}

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated users cannot read or write profiles or meal plans", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const ts = new Date(Date.now() - 2000);

  await assertFails(unauthDb.collection("users").doc(ALICE_UID).get());
  await assertFails(
    unauthDb.collection("users").doc(ALICE_UID).set(validProfilePayload(ALICE_UID, ts))
  );
  await assertFails(
    unauthDb.collection("users").doc(ALICE_UID).collection("mealPlans").get()
  );
  await assertFails(
    unauthDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("mealPlans")
      .doc("plan_1")
      .set(validMealPlanPayload(ALICE_UID, ts))
  );
});

test("Owner can create and partially update profile, cannot delete or inject ghost/future fields", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const created = new Date(Date.now() - 10000);

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).set(validProfilePayload(ALICE_UID, created))
  );

  await assertSucceeds(aliceDb.collection("users").doc(ALICE_UID).get());

  // Action branch: updating dietary preferences preserves createdAt & userId
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).update({
      goal: "کاهش وزن و چربی‌سوزی",
      mealCount: 5,
      bodyStats: "وزن 72 کیلو",
      preferredFoods: "ماهی، جو دوسر",
      restrictions: "بدون قند",
      extraNotes: "اقتصادی",
      updatedAt: new Date(Date.now() - 1000),
    })
  );

  // Action branch: refreshing Google identity metadata on another device
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).update({
      displayName: "Kia Updated",
      email: "kia@example.com",
      photoUrl: "https://example.com/avatar.png",
      updatedAt: new Date(Date.now() - 500),
    })
  );

  // Deletion must ALWAYS fail ("هیچ چیزی حذف نشه")
  await assertFails(aliceDb.collection("users").doc(ALICE_UID).delete());

  // Immutable createdAt mutation must fail
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).update({
      createdAt: new Date(Date.now() - 200),
      updatedAt: new Date(Date.now() - 200),
    })
  );

  // Ghost field / shadow update must fail
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).update({
      isAdmin: true,
      updatedAt: new Date(Date.now() - 200),
    })
  );

  // Future timestamp spoofing must fail
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).update({
      goal: "تغذیه سالم",
      updatedAt: new Date(Date.now() + 60000),
    })
  );
});

test("Owner can create and list meal plans (even empty), cannot update or delete them", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const ts = new Date(Date.now() - 5000);

  // Empty subcollection list must succeed (no existing() inspection in allow list)
  await assertSucceeds(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("mealPlans")
      .orderBy("createdAt", "desc")
      .get()
  );

  // Valid meal plan create succeeds (no redundant `id` key)
  await assertSucceeds(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("mealPlans")
      .doc("plan_1")
      .set(validMealPlanPayload(ALICE_UID, ts))
  );

  // List query matching Kotlin repository succeeds
  await assertSucceeds(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("mealPlans")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get()
  );

  // Extra `@DocumentId` id field rejected
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("mealPlans")
      .doc("plan_2")
      .set({
        id: "plan_2",
        ...validMealPlanPayload(ALICE_UID, ts),
      })
  );

  // Update and delete on meal plans must ALWAYS fail
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("mealPlans")
      .doc("plan_1")
      .update({ planTitle: "Modified" })
  );
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("mealPlans")
      .doc("plan_1")
      .delete()
  );
});

test("Cross-user isolation: Bob cannot read or write Alice's profile or meal plans", async () => {
  const ts = new Date(Date.now() - 10000);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await adminDb.collection("users").doc(ALICE_UID).set(validProfilePayload(ALICE_UID, ts));
    await adminDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("mealPlans")
      .doc("plan_1")
      .set(validMealPlanPayload(ALICE_UID, ts));
  });

  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  await assertFails(bobDb.collection("users").doc(ALICE_UID).get());
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).set(validProfilePayload(BOB_UID, ts))
  );
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).collection("mealPlans").get()
  );
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).collection("mealPlans").doc("plan_1").get()
  );
  await assertFails(
    bobDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("mealPlans")
      .doc("plan_bob")
      .set(validMealPlanPayload(BOB_UID, ts))
  );
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).collection("progressLogs").get()
  );
  await assertFails(
    bobDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_bob")
      .set(validProgressLogPayload(BOB_UID, ts))
  );
});

test("Unauthenticated users cannot read or write progressLogs", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const ts = new Date(Date.now() - 2000);

  await assertFails(
    unauthDb.collection("users").doc(ALICE_UID).collection("progressLogs").get()
  );
  await assertFails(
    unauthDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_1")
      .set(validProgressLogPayload(ALICE_UID, ts))
  );
});

test("Owner can create and list progressLogs (even empty), validates bounds, rejects update/delete/id", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const ts = new Date(Date.now() - 5000);

  // Empty collection list must succeed
  await assertSucceeds(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get()
  );

  // Valid WORKOUT log succeeds
  await assertSucceeds(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_1")
      .set(validProgressLogPayload(ALICE_UID, ts))
  );

  // Valid MILESTONE log with weightTenthsKg=0 (omitted) succeeds
  await assertSucceeds(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_2")
      .set({
        userId: ALICE_UID,
        category: "MILESTONE",
        title: "کسب کمربند قهوه‌ای",
        durationMinutes: 0,
        readinessScore: 95,
        weightTenthsKg: 0,
        sessionDateIso: "2026-11-19",
        notes: "",
        createdAt: ts,
        updatedAt: ts,
      })
  );

  // Ordered query succeeds
  await assertSucceeds(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get()
  );

  // Reject extra @DocumentId id field
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_bad_id")
      .set({
        id: "log_bad_id",
        ...validProgressLogPayload(ALICE_UID, ts),
      })
  );

  // Reject invalid category / readinessScore out of range / bad date
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_bad_cat")
      .set({
        ...validProgressLogPayload(ALICE_UID, ts),
        category: "OTHER",
      })
  );
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_bad_score")
      .set({
        ...validProgressLogPayload(ALICE_UID, ts),
        readinessScore: 105,
      })
  );
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_bad_date")
      .set({
        ...validProgressLogPayload(ALICE_UID, ts),
        sessionDateIso: "2026/11/19",
      })
  );

  // Immutable: update and delete MUST fail
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_1")
      .update({ readinessScore: 99 })
  );
  await assertFails(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("progressLogs")
      .doc("log_1")
      .delete()
  );
});
