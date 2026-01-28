import { signIn, auth, signOut } from "@/auth";
//import Image from "next/image";
import styles from "./login.module.css";

export default async function Home() {
  const session = await auth();

  return (
    <div className={styles.loginWrapper}>
      {session !== null ? (
        <div className={styles.loggedIn}>
          <h1>{session.user?.name}がログインしたよ</h1>

          {session.user?.image && (
            <img
              src={session.user.image}
              alt="user image"
              width={80}
              height={80}
              className={styles.avatar}
            />
          )}

          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button type="submit" className={styles.signOutButton}>
              Sign out
            </button>
          </form>
        </div>
      ) : (
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
      )}
    </div>
  );
}
