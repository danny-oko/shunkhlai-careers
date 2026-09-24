/* eslint-disable camelcase -- every key below is Clerk's, not ours: the
   `__variant` suffixes are its localization keys and the snake_case ones are
   its API error codes. This is the same reason `eslint.config.mjs` turns the
   rule off over `src/lib/api/**`, which mirrors the recruitment backend's
   payload names; renaming one here would silently fall back to English. */
import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";

/**
 * Clerk's sign-in and sign-up cards, in Mongolian.
 *
 * Clerk ships no `mn-MN` bundle, so every string a candidate can reach on those
 * two screens is written out here; anything left out falls back to Clerk's
 * English. The keys are Clerk's own and are checked by `LocalizationResource` -
 * a typo in one is a type error, not a silently English line.
 *
 * Only the flows this site actually opens are covered: identifier-first sign-in
 * with Google and an email code, sign-up, password entry and reset, and the
 * errors those can raise. Organisations, billing, waitlists, passkeys and the
 * user-profile screens are not mounted anywhere in this app and are left to
 * Clerk. `{{identifier}}` and `{{provider|titleize}}` are Clerk's own
 * placeholders - they must survive translation exactly as written.
 */
type ClerkLocalization = NonNullable<
  ComponentProps<typeof ClerkProvider>["localization"]
>;

export const clerkLocalizationMn: ClerkLocalization = {
  locale: "mn-MN",

  /* ---- shared across every card ---- */
  socialButtonsBlockButton: "{{provider|titleize}}-ээр үргэлжлүүлэх",
  dividerText: "эсвэл",
  formButtonPrimary: "Үргэлжлүүлэх",
  formButtonPrimary__verify: "Баталгаажуулах",
  backButton: "Буцах",
  signInEnterPasswordTitle: "Нууц үгээ оруулна уу",
  footerActionLink__useAnotherMethod: "Өөр аргаар нэвтрэх",

  formFieldLabel__emailAddress: "И-мэйл хаяг",
  formFieldLabel__emailAddress_username: "И-мэйл хаяг эсвэл хэрэглэгчийн нэр",
  formFieldLabel__phoneNumber: "Утасны дугаар",
  formFieldLabel__username: "Хэрэглэгчийн нэр",
  formFieldLabel__password: "Нууц үг",
  formFieldLabel__currentPassword: "Одоогийн нууц үг",
  formFieldLabel__newPassword: "Шинэ нууц үг",
  formFieldLabel__confirmPassword: "Нууц үгээ давтана уу",
  formFieldLabel__firstName: "Нэр",
  formFieldLabel__lastName: "Овог",
  formFieldLabel__backupCode: "Нөөц код",
  formFieldLabel__signOutOfOtherSessions: "Бусад бүх төхөөрөмжөөс гарах",

  formFieldInputPlaceholder__emailAddress: "И-мэйл хаягаа оруулна уу",
  formFieldInputPlaceholder__emailAddress_username:
    "И-мэйл хаяг эсвэл хэрэглэгчийн нэрээ оруулна уу",
  formFieldInputPlaceholder__phoneNumber: "Утасны дугаараа оруулна уу",
  formFieldInputPlaceholder__username: "Хэрэглэгчийн нэрээ оруулна уу",
  formFieldInputPlaceholder__password: "Нууц үгээ оруулна уу",
  formFieldInputPlaceholder__signUpPassword: "Нууц үг зохионо уу",
  formFieldInputPlaceholder__firstName: "Нэр",
  formFieldInputPlaceholder__lastName: "Овог",
  formFieldInputPlaceholder__backupCode: "Нөөц кодоо оруулна уу",

  formFieldAction__forgotPassword: "Нууц үгээ мартсан уу?",
  formFieldHintText__optional: "Заавал биш",
  formFieldError__notMatchingPasswords: "Нууц үг хоорондоо таарахгүй байна.",
  formFieldError__matchingPasswords: "Нууц үг таарлаа.",
  formFieldError__verificationLinkExpired:
    "Баталгаажуулах холбоосны хугацаа дууссан байна. Шинээр авна уу.",

  /* ---- нэвтрэх ---- */
  signIn: {
    start: {
      title: "Нэвтрэх",
      subtitle: "Ажлын байрны хүсэлт илгээхийн тулд нэвтэрнэ үү",
      titleCombined: "Нэвтрэх",
      subtitleCombined: "Ажлын байрны хүсэлт илгээхийн тулд нэвтэрнэ үү",
      actionText: "Бүртгэл байхгүй юу?",
      actionLink: "Бүртгүүлэх",
      actionLink__use_email: "И-мэйлээр нэвтрэх",
      actionLink__use_phone: "Утасны дугаараар нэвтрэх",
      actionLink__use_username: "Хэрэглэгчийн нэрээр нэвтрэх",
      actionLink__use_email_username:
        "И-мэйл эсвэл хэрэглэгчийн нэрээр нэвтрэх",
    },
    password: {
      title: "Нууц үгээ оруулна уу",
      subtitle: "Бүртгэлдээ холбогдсон нууц үгээ оруулна уу",
      actionLink: "Өөр аргаар нэвтрэх",
    },
    emailCode: {
      title: "И-мэйлээ шалгана уу",
      subtitle: "Үргэлжлүүлэхийн тулд баталгаажуулах кодоо оруулна уу",
      formTitle: "Баталгаажуулах код",
      resendButton: "Код ирээгүй юу? Дахин илгээх",
    },
    phoneCode: {
      title: "Утсаа шалгана уу",
      subtitle: "Үргэлжлүүлэхийн тулд баталгаажуулах кодоо оруулна уу",
      formTitle: "Баталгаажуулах код",
      resendButton: "Код ирээгүй юу? Дахин илгээх",
    },
    forgotPasswordAlternativeMethods: {
      title: "Нууц үгээ мартсан уу?",
      label__alternativeMethods: "Эсвэл өөр аргаар нэвтэрнэ үү",
      blockButton__resetPassword: "Нууц үгээ сэргээх",
    },
    forgotPassword: {
      title: "Нууц үг сэргээх",
      subtitle: "Эхлээд и-мэйлд ирсэн кодыг оруулна уу",
      subtitle_email: "Эхлээд и-мэйлд ирсэн кодыг оруулна уу",
      subtitle_phone: "Эхлээд утсанд ирсэн кодыг оруулна уу",
      formTitle: "Сэргээх код",
      resendButton: "Код ирээгүй юу? Дахин илгээх",
    },
    resetPassword: {
      title: "Шинэ нууц үг тохируулах",
      formButtonPrimary: "Нууц үгээ солих",
      successMessage: "Нууц үг солигдлоо. Түр хүлээнэ үү...",
      requiredMessage:
        "Аюулгүй байдлын үүднээс шинэ нууц үг тохируулах шаардлагатай.",
    },
    alternativeMethods: {
      title: "Өөр аргаар нэвтрэх",
      subtitle: "Доорх аргуудаас сонгоно уу.",
      actionText: "Аль нь ч боломжгүй байна уу?",
      actionLink: "Тусламж авах",
      blockButton__emailCode: "{{identifier}} хаяг руу код илгээх",
      blockButton__emailLink: "{{identifier}} хаяг руу холбоос илгээх",
      blockButton__phoneCode: "{{identifier}} дугаар руу код илгээх",
      blockButton__password: "Нууц үгээрээ нэвтрэх",
      getHelp: {
        title: "Тусламж",
        content:
          "Нэвтрэхэд бэрхшээл гарвал Шунхлайн Хүний нөөцийн албатай холбогдоно уу. Бид тантай хамт шийдвэрлэнэ.",
        blockButton__emailSupport: "И-мэйлээр холбогдох",
      },
    },
    noAvailableMethods: {
      title: "Нэвтрэх боломжгүй байна",
      subtitle: "Алдаа гарлаа",
      message: "Одоогоор нэвтрэх боломжтой арга алга байна.",
    },
    accountSwitcher: {
      title: "Бүртгэл солих",
      subtitle: "Үргэлжлүүлэх бүртгэлээ сонгоно уу.",
      action__addAccount: "Бүртгэл нэмэх",
      action__signOutAll: "Бүх бүртгэлээс гарах",
    },
  },

  /* ---- бүртгүүлэх ---- */
  signUp: {
    start: {
      title: "Бүртгүүлэх",
      subtitle: "Ажлын байрны хүсэлт илгээхийн тулд бүртгэл үүсгэнэ үү",
      titleCombined: "Бүртгүүлэх",
      subtitleCombined: "Ажлын байрны хүсэлт илгээхийн тулд бүртгэл үүсгэнэ үү",
      actionText: "Бүртгэлтэй юу?",
      actionLink: "Нэвтрэх",
      actionLink__use_email: "И-мэйлээр бүртгүүлэх",
      actionLink__use_phone: "Утасны дугаараар бүртгүүлэх",
    },
    emailCode: {
      title: "И-мэйлээ баталгаажуулна уу",
      subtitle: "Үргэлжлүүлэхийн тулд и-мэйлд ирсэн кодыг оруулна уу",
      formTitle: "Баталгаажуулах код",
      formSubtitle: "И-мэйл хаяг руу тань илгээсэн кодыг оруулна уу",
      resendButton: "Код ирээгүй юу? Дахин илгээх",
    },
    phoneCode: {
      title: "Утсаа баталгаажуулна уу",
      subtitle: "Үргэлжлүүлэхийн тулд утсанд ирсэн кодыг оруулна уу",
      formTitle: "Баталгаажуулах код",
      formSubtitle: "Утсанд тань илгээсэн кодыг оруулна уу",
      resendButton: "Код ирээгүй юу? Дахин илгээх",
    },
    continue: {
      title: "Дутуу мэдээллээ нөхнө үү",
      subtitle: "Үргэлжлүүлэхийн тулд доорх талбаруудыг бөглөнө үү",
      actionText: "Бүртгэлтэй юу?",
      actionLink: "Нэвтрэх",
    },
    legalConsent: {
      continue: {
        title: "Нөхцөл зөвшөөрөх",
        subtitle: "Үргэлжлүүлэхийн өмнө нөхцөлтэй танилцана уу",
      },
      checkbox: {
        label__termsOfServiceAndPrivacyPolicy:
          '{{ termsOfServiceLink || link("Үйлчилгээний нөхцөл") }} болон {{ privacyPolicyLink || link("Нууцлалын бодлого") }}-той танилцаж, зөвшөөрч байна',
        label__onlyPrivacyPolicy:
          '{{ privacyPolicyLink || link("Нууцлалын бодлого") }}-той танилцаж, зөвшөөрч байна',
        label__onlyTermsOfService:
          '{{ termsOfServiceLink || link("Үйлчилгээний нөхцөл") }}-той танилцаж, зөвшөөрч байна',
      },
    },
  },

  /* ---- алдааны мэдэгдэл ---- */
  unstable__errors: {
    form_identifier_not_found: "Ийм бүртгэл олдсонгүй.",
    form_password_incorrect: "Нууц үг буруу байна.",
    form_password_or_identifier_incorrect: "И-мэйл эсвэл нууц үг буруу байна.",
    form_code_incorrect: "Код буруу байна. Дахин шалгана уу.",
    form_param_nil: "Энэ талбарыг бөглөнө үү.",
    form_param_format_invalid: "Оруулсан утга буруу форматтай байна.",
    form_param_format_invalid__email_address:
      "И-мэйл хаяг буруу форматтай байна.",
    form_param_type_invalid__email_address:
      "И-мэйл хаяг буруу форматтай байна.",
    form_param_type_invalid__phone_number:
      "Утасны дугаар буруу форматтай байна.",
    form_identifier_exists: "Энэ бүртгэл аль хэдийн үүссэн байна.",
    form_identifier_exists__email_address:
      "Энэ и-мэйл хаягаар бүртгэл үүссэн байна.",
    form_identifier_exists__phone_number:
      "Энэ утасны дугаараар бүртгэл үүссэн байна.",
    form_password_length_too_short: "Нууц үг хэт богино байна.",
    form_password_not_strong_enough: "Нууц үг хангалттай найдваргүй байна.",
    form_password_pwned:
      "Энэ нууц үг задарсан мэдээллийн жагсаалтад байна. Өөр нууц үг сонгоно уу.",
    form_password_validation_failed: "Нууц үг таарахгүй байна.",
    form_email_address_blocked: "Энэ и-мэйл хаягийг ашиглах боломжгүй.",
    not_allowed_access: "Танд энд хандах эрх алга.",
    session_exists: "Та аль хэдийн нэвтэрсэн байна.",
    oauth_access_denied: "Хандалт цуцлагдлаа.",
    captcha_invalid:
      "Аюулгүй байдлын шалгалт амжилтгүй болсон тул бүртгэл үүсгэж чадсангүй. Хуудсыг дахин ачаална уу.",
    captcha_unavailable:
      "Аюулгүй байдлын шалгалт хийх боломжгүй байна. Хуудсыг дахин ачаална уу.",
    passwordComplexity: {
      sentencePrefix: "Нууц үг дараахыг агуулсан байх ёстой:",
      minimumLength: "{{length}} ба түүнээс дээш тэмдэгт",
      maximumLength: "{{length}}-аас ихгүй тэмдэгт",
      requireNumbers: "тоо",
      requireLowercase: "жижиг үсэг",
      requireUppercase: "том үсэг",
      requireSpecialCharacter: "тусгай тэмдэгт",
    },
  },
};
