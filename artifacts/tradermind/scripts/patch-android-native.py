import json
import os
import re
from pathlib import Path


ANDROID_DIR = Path(__file__).resolve().parents[1] / "android"
MAIN_ACTIVITY = (
    ANDROID_DIR
    / "app/src/main/java/app/tradermind/os/MainActivity.java"
)
MANIFEST = ANDROID_DIR / "app/src/main/AndroidManifest.xml"
BUILD_GRADLE = ANDROID_DIR / "app/build.gradle"
PACKAGE_JSON = ANDROID_DIR.parent / "package.json"


def patch_main_activity() -> None:
    MAIN_ACTIVITY.write_text(
        """package app.tradermind.os;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }
}
""",
        encoding="utf-8",
    )


def patch_manifest() -> None:
    content = MANIFEST.read_text(encoding="utf-8")
    if "android:windowSoftInputMode=" not in content:
        marker = '            android:launchMode="singleTask"'
        if marker not in content:
            raise RuntimeError("Could not find the generated MainActivity entry")
        content = content.replace(
            marker,
            marker + '\n            android:windowSoftInputMode="adjustResize"',
            1,
        )
        MANIFEST.write_text(content, encoding="utf-8")


def patch_app_version() -> None:
    package = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    version = package.get("version")
    if not isinstance(version, str) or not version:
        raise RuntimeError("Could not read the app version from package.json")

    parts = version.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise RuntimeError(f"Unsupported app version: {version}")

    version_code = int(parts[0]) * 10_000 + int(parts[1]) * 100 + int(parts[2])
    content = BUILD_GRADLE.read_text(encoding="utf-8")
    content, code_count = re.subn(
        r"(?m)^(\s*versionCode\s+)\d+\s*$",
        rf"\g<1>{version_code}",
        content,
        count=1,
    )
    content, name_count = re.subn(
        r'(?m)^(\s*versionName\s+")[^"]+("\s*)$',
        rf'\g<1>{version}\g<2>',
        content,
        count=1,
    )
    if code_count != 1 or name_count != 1:
        raise RuntimeError("Could not update Android version fields")
    BUILD_GRADLE.write_text(content, encoding="utf-8")


def patch_release_signing() -> None:
    """در صورت وجود متغیرهای محیطی keystore (تنظیم‌شده در CI از GitHub Secrets)،
    یک signingConfig ثابت به build.gradle اضافه می‌کند تا امضای هر build یکسان
    بماند و اندروید بتواند نسخه‌های بعدی را به‌عنوان آپدیت (نه نصب متداخل) بپذیرد.
    اگر متغیرها ست نشده باشند (مثلاً build محلی)، هیچ تغییری اعمال نمی‌شود."""
    keystore_path = os.environ.get("ANDROID_KEYSTORE_PATH")
    keystore_password = os.environ.get("ANDROID_KEYSTORE_PASSWORD")
    key_alias = os.environ.get("ANDROID_KEY_ALIAS")
    key_password = os.environ.get("ANDROID_KEY_PASSWORD")

    if not all([keystore_path, keystore_password, key_alias, key_password]):
        print("Skipping release signing patch (keystore env vars not set)")
        return

    content = BUILD_GRADLE.read_text(encoding="utf-8")
    if "signingConfigs" in content:
        print("signingConfigs already present in build.gradle, skipping")
        return

    keystore_path_escaped = keystore_path.replace("\\", "\\\\")
    signing_configs_block = f"""    signingConfigs {{
        release {{
            storeFile file("{keystore_path_escaped}")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }}
    }}
"""

    content, android_count = re.subn(
        r"(?m)^android \{\n",
        "android {\n" + signing_configs_block,
        content,
        count=1,
    )
    if android_count != 1:
        raise RuntimeError("Could not find 'android {' block to insert signingConfigs")

    content, release_count = re.subn(
        r"(?m)^(\s*release \{\n)",
        r"\1            signingConfig signingConfigs.release\n",
        content,
        count=1,
    )
    if release_count != 1:
        raise RuntimeError("Could not find 'release {' buildType block to attach signingConfig")

    BUILD_GRADLE.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    if not MAIN_ACTIVITY.exists() or not MANIFEST.exists() or not BUILD_GRADLE.exists():
        raise SystemExit("Capacitor Android project has not been generated")
    patch_main_activity()
    patch_manifest()
    patch_app_version()
    patch_release_signing()
    print("Applied Android keyboard resize and app version compatibility patches")
