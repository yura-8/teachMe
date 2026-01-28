import { signIn, auth } from "@/auth";
import styles from "./login.module.css";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/kambe");
  }

  return (
    <div className={styles.loginWrapper}>
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button type="submit" className={styles.gsiMaterialButton}>
          <div className={styles.gsiMaterialButtonState}></div>

          <div className={styles.gsiMaterialButtonContentWrapper}>
            <div className={styles.gsiMaterialButtonIcon}>
              <img
                src="/googleicon.svg"
                alt="Google icon"
                width={80}
                height={80}
              />
            </div>

            <span className={styles.gsiMaterialButtonContents}>
              Googleでログインして始める。
            </span>
          </div>
        </button>
      </form>
    </div>
  );
}
