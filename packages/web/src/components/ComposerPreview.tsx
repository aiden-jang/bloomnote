import type { GardenData } from '../garden'
import RecipientView from './RecipientView'
import styles from './GardenResult.module.css'

export default function ComposerPreview({ garden, gardenId }: { garden: GardenData; gardenId: string }) {
  return (
    <section className={styles.recipientPreview} aria-label="Recipient preview">
      <RecipientView gardenData={garden} gardenId={gardenId} preview />
    </section>
  )
}
