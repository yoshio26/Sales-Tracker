import image from '../Camellia.jpg'
import styles from './Camellia.module.css'
import { camelliaContent } from './camelliaContent'

type CamelliaProps = {
  onBack: () => void
}

export function Camellia({ onBack }: CamelliaProps) {
  return <section className={styles.page} aria-labelledby="camellia-heading">
    <article className={styles.card}>
      <div className={styles.imagePanel}>
        <img className={styles.image} src={image} alt="A pink camellia bouquet" />
      </div>
      <div className={styles.copy}>
        <h2 className={styles.title} id="camellia-heading">{camelliaContent.title}</h2>
        {camelliaContent.paragraphs.map((paragraph) => <p className={styles.paragraph} key={paragraph}>{paragraph}</p>)}
        <p className={styles.closing}>{camelliaContent.closing}</p>
        <button className={styles.backLink} type="button" onClick={onBack}>{camelliaContent.backLabel}</button>
      </div>
    </article>
  </section>
}
