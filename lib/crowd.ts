export type CrowdBand = 'Low' | 'Moderate' | 'High';

export interface CrowdEstimate {
  band: CrowdBand;
  label: string;
  dotColor: string;
  textColor: string;
  description: string;
  tip: string;
}

/**
 * Shared heuristic for estimating station & train passenger density.
 * Evaluates in Indian Standard Time (IST) to ensure consistency across server and client.
 */
export function getEstimatedCrowd(
  trainName: string = '',
  delayMinutes: number = 0
): CrowdEstimate {
  const istFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    weekday: 'short',
    hour12: false,
  });

  const parts = istFormatter.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '12', 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Mon';

  const isPeak = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20);
  const isWeekendRush = weekday === 'Sun' || weekday === 'Fri';

  const nameLower = trainName.toLowerCase();
  const isPremiumAC =
    nameLower.includes('rajdhani') ||
    nameLower.includes('shatabdi') ||
    nameLower.includes('vande bharat') ||
    nameLower.includes('tejas') ||
    nameLower.includes('gatimaan');
  const isGeneralLocal =
    nameLower.includes('passenger') ||
    nameLower.includes('local') ||
    nameLower.includes('memu') ||
    nameLower.includes('demu');

  let points = isPeak ? 3 : 1;
  if (isWeekendRush) points += 1;
  if (isPremiumAC) points -= 1;
  if (isGeneralLocal) points += 2;
  if (delayMinutes > 45) points += 1;

  if (points <= 2) {
    return {
      band: 'Low',
      label: 'Low Crowd',
      dotColor: 'bg-emerald-500',
      textColor: 'text-emerald-500 dark:text-emerald-400',
      description: 'Platform and coach boarding expected to be smooth with lighter passenger density.',
      tip: 'Good time for luggage movement and boarding with family.',
    };
  } else if (points <= 4) {
    return {
      band: 'Moderate',
      label: 'Moderate Crowd',
      dotColor: 'bg-amber-500',
      textColor: 'text-amber-500 dark:text-amber-400',
      description: 'Standard boarding load expected across general and reserved coaches.',
      tip: 'Arrive at platform 15–20 minutes before train arrival.',
    };
  } else {
    return {
      band: 'High',
      label: 'High Crowd',
      dotColor: 'bg-rose-500',
      textColor: 'text-rose-500 dark:text-rose-400',
      description: 'Heavy passenger density expected on platform and general compartments.',
      tip: 'Reach your coach position early and keep luggage compact.',
    };
  }
}
