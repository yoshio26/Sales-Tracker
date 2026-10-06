import styles from '../App.module.css'
import { motivationParagraphs } from './motivationContent'

export function MotivationPage() {
  return <section className={styles.motivationPage} aria-labelledby="motivation-heading">
    <article className={styles.motivationCard}>
      <header className={styles.motivationHeader}>
        <p className={styles.motivationSubtitle}>A little note for you</p>
        <h2 id="motivation-heading">Motivation</h2>
      </header>
      <div className={styles.motivationLetter}>
        {motivationParagraphs.map((paragraph, index) => <p className={index === 0 ? styles.motivationGreeting : index === motivationParagraphs.length - 1 ? styles.motivationClosing : undefined} key={paragraph}>{paragraph}</p>)}
      </div>
    </article>
  </section>
}
