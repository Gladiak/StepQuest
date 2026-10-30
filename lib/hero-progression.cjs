'use strict';

const experienceNeeded = level => 80 + level * 40;

function advanceExperience(progress, earned) {
 let level = progress.level, xp = progress.xp + earned;
 while (xp >= experienceNeeded(level)) {
  xp -= experienceNeeded(level);
  level++;
 }
 return { level, xp };
}

module.exports = { experienceNeeded, advanceExperience };
