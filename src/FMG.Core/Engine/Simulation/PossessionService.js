/**
 * Possession calculation logic for FMG.Core.
 */

import { RNG } from './RNG';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Calculates possession for a match between two teams based on tactical profiles and strength.
 * @param {Object} homeProfile - Tactical profile of the home team.
 * @param {Object} awayProfile - Tactical profile of the away team.
 * @param {number} strengthDelta - Difference in strength between home and away team.
 * @param {RNG} rng - RNG instance.
 * @returns {Object} Possession statistics { home: number, away: number }.
 */
export const calculatePossession = (homeProfile, awayProfile, strengthDelta, rng) => {
  const tacticalPossession = homeProfile.possession - awayProfile.possession;
  
  // Deterministic calculation using the provided RNG
  const randomFactor = rng.nextRange(-5, 5);
  
  const homePossession = clamp(
    Math.round(50 + strengthDelta * 0.38 + tacticalPossession * 0.75 + randomFactor),
    32,
    68
  );
  
  const awayPossession = 100 - homePossession;
  
  return {
    home: homePossession,
    away: awayPossession
  };
};
