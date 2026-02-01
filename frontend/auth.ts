import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  // 以前のSwiftUIの時のように、余計な設定を省いてシンプルに動かすための設定
  trustHost: true,
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      // Googleでログイン成功時にバックエンドに送信
      if (account?.provider === "google" && user.email) {
        try {
          console.log("📤 Sending user data to backend:", {
            email: user.email,
            name: user.name,
            avatar_url: user.image,
          });

          const response = await fetch(
            "http://app:8080/api/users/login",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: user.email,
                name: user.name,
                avatar_url: user.image,
              }),
            }
          );

          const responseData = await response.json();
          console.log("📥 Backend response:", response.status, responseData);

          if (!response.ok) {
            console.error("❌ Backend returned error:", response.status);
          } else {
            console.log("✅ User data successfully sent to backend");
          }
        } catch (error) {
          console.error("❌ Failed to send user data to backend:", error);
        }
      }
      return true; // バックエンド送信の成否に関わらずログインは成功させる
    },
  },
})