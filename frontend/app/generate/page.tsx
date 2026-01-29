import GenerateClient from "./GenerateClient";
import styles from "./generate.module.css";

export default async function GeneratePage() {
  return (
    <div className={styles.generateWrapper}>
      <GenerateClient />
    </div>
  );
}
