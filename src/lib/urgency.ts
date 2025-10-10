/**
 * Calculate urgency score for a task based on multiple factors
 * Formula: UrgencyScore = w1*TimeDecay + w2*Criticality + w3*OverdueFlag + w4*ProximityToShiftEnd
 * Weights: w1=0.4, w2=0.3, w3=0.2, w4=0.1
 */

export function calculateTimeDecay(dueAt: Date, now: Date = new Date()): number {
  const minutesUntilDue = (dueAt.getTime() - now.getTime()) / (1000 * 60);

  if (minutesUntilDue <= 0) {
    return 1.0; // Overdue
  } else if (minutesUntilDue <= 60) {
    // Steep logistic curve in last 60 minutes
    return 1.0 / (1.0 + Math.exp(0.1 * (minutesUntilDue - 30)));
  } else {
    // Gradual increase before 60 minutes
    return 1.0 / (1.0 + Math.exp(0.02 * (minutesUntilDue - 180)));
  }
}

export function calculateCriticality(level: number): number {
  // Map 1-5 to 0.2-1.0
  return Math.max(0.2, Math.min(1.0, level * 0.2));
}

export function calculateOverdueFlag(dueAt: Date, now: Date = new Date()): number {
  return dueAt < now ? 1.0 : 0.0;
}

export function calculateShiftProximity(
  shiftEnd: Date | null,
  now: Date = new Date()
): number {
  if (!shiftEnd) return 0.0;

  const minutesUntilShiftEnd = (shiftEnd.getTime() - now.getTime()) / (1000 * 60);
  return minutesUntilShiftEnd > 0 && minutesUntilShiftEnd <= 30 ? 0.3 : 0.0;
}

export interface TaskUrgencyInput {
  dueAt: Date;
  windowStart?: Date | null;
  windowEnd?: Date | null;
  criticality: number;
}

export function calculateUrgencyScore(
  task: TaskUrgencyInput,
  now: Date = new Date()
): number {
  const timeDecay = calculateTimeDecay(task.dueAt, now);
  const criticality = calculateCriticality(task.criticality);
  const overdueFlag = calculateOverdueFlag(task.dueAt, now);
  const shiftProximity = calculateShiftProximity(task.windowEnd || null, now);

  // Weighted sum
  const w1 = 0.4, w2 = 0.3, w3 = 0.2, w4 = 0.1;
  const score = w1 * timeDecay + w2 * criticality + w3 * overdueFlag + w4 * shiftProximity;
  
  // Ensure overdue tasks always have critical urgency (>= 0.8)
  if (overdueFlag === 1.0 && score < 0.8) {
    return 0.8;
  }
  
  return score;
}

export function getUrgencyLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

export function getUrgencyColor(score: number): string {
  const level = getUrgencyLevel(score);
  switch (level) {
    case 'critical': return 'hsl(var(--destructive))';
    case 'high': return 'hsl(var(--warning))';
    case 'medium': return 'hsl(var(--accent))';
    case 'low': return 'hsl(var(--muted))';
  }
}
