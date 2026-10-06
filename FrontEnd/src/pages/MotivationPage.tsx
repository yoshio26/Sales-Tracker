import styles from '../App.module.css'
import { motivationActions, motivationParagraphs } from './motivationContent'

type MotivationPageProps = {
  onViewCamellia: () => void
}

export function MotivationPage({ onViewCamellia }: MotivationPageProps) {
  return <section className={styles.motivationPage} aria-labelledby="motivation-heading">
    <article className={styles.motivationCard}>
      <header className={styles.motivationHeader}>
        <p className={styles.motivationSubtitle}>A little note for you</p>
        <h2 id="motivation-heading">Motivation</h2>
      </header>
      <div className={styles.motivationLetter}>
        {motivationParagraphs.map((paragraph, index) => <p className={index === 0 ? styles.motivationGreeting : index === motivationParagraphs.length - 1 ? styles.motivationClosing : undefined} key={paragraph}>{paragraph}</p>)}
      </div>
      <button className={styles.motivationFlowerButton} type="button" onClick={onViewCamellia}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-6m0 0c-2.2 0-4-1.8-4-4 0-1.2.5-2.3 1.4-3.1C9.7 7.1 10.8 7 12 8c1.2-1 2.3-.9 2.6-.1.9.8 1.4 1.9 1.4 3.1 0 2.2-1.8 4-4 4Zm0-7c-1.7-1.3-2.1-3.2-1.2-4.7C11.3 8 12 7.1 12 5.8c0-1.4-1-2.6-2.4-3.1C9.3 4.3 9.7 6 11 7m1 7c1.7-1.3 2.1-3.2 1.2-4.7C12.7 8 12 7.1 12 5.8c0-1.4 1-2.6 2.4-3.1.3 1.6-.1 3.3-1.4 4.3" /></svg>
        {motivationActions.flowerLabel}
      </button>
    </article>
  </section>
}
