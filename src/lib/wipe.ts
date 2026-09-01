import { clearProfile } from './storage'
import { clearNotifications } from './notify'

/**
 * Removes every piece of personal data from **this** device.
 *
 * Called from two places: signing out, and Reset. In both the person expects
 * nothing to be left behind — on a shared phone or computer that expectation
 * is the only thing protecting them.
 *
 * Personal data does not live in the profile alone: the notification plan
 * holds leave dates and duty times, and the icon badge shows the days left.
 * All of it goes together.
 *
 * The interface language and the dismissed install banner are left alone.
 * Those are device preferences, not facts about the person.
 */
export async function wipeDevice(): Promise<boolean> {
  const ok = clearProfile()
  await clearNotifications()
  return ok
}
