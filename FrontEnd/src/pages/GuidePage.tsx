import styles from '../App.module.css'
import { guideContent } from './guideContent'

export function GuidePage() {
  return <section className={styles.guidePage} aria-labelledby="guide-heading">
    <article className={styles.guideWelcome}>
      <p className={styles.guideEyebrow}>{guideContent.welcome.eyebrow}</p>
      <h2 id="guide-heading">{guideContent.welcome.title}</h2>
      <p>{guideContent.welcome.description}</p>
    </article>

    <section className={styles.guideCard} aria-labelledby="quick-start-heading">
      <h2 id="quick-start-heading">{guideContent.quickStart.title}</h2>
      <ol className={styles.guideList}>{guideContent.quickStart.steps.map((step) => <li key={step}>{step}</li>)}</ol>
    </section>

    <section className={styles.guideAccordion} aria-labelledby="guide-sections-heading">
      <h2 id="guide-sections-heading">Learn each page</h2>
      {guideContent.sections.map((section) => <details className={styles.guideDetails} key={section.title}>
        <summary>{section.title}</summary>
        <div className={styles.guideDetailsBody}>
          <h3>What it’s for</h3>
          <p>{section.whatItIsFor}</p>
          <h3>How to use it</h3>
          <ol className={styles.guideList}>{section.howToUse.map((step) => <li key={step}>{step}</li>)}</ol>
          <h3>Tips</h3>
          <ul className={styles.guideTips}>{section.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </div>
      </details>)}
    </section>

    <aside className={styles.guideWarning} aria-labelledby="guide-warning-heading">
      <h2 id="guide-warning-heading">{guideContent.warning.title}</h2>
      <p>{guideContent.warning.text}</p>
    </aside>

    <section className={styles.guideCard} aria-labelledby="faq-heading">
      <h2 id="faq-heading">Frequently asked questions</h2>
      <div className={styles.guideFaq}>{guideContent.faq.map((item) => <details key={item.question}>
        <summary>{item.question}</summary>
        <p>{item.answer}</p>
      </details>)}</div>
    </section>

    <article className={styles.guideMessage}>
      <h2>A note for you</h2>
      <p>{guideContent.personalMessage}</p>
    </article>
  </section>
}
