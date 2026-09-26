// Visual walls and collision volumes use the same centered grid cells.
export const CELL_SIZE = 3;
export const PLAYER_RADIUS = .38;
const GAP = .0001;
const index = value => Math.floor(value / CELL_SIZE + .5);
const solid = (grid, x, z) => grid[z]?.[x] !== 0;

export function canOccupy(grid, x, z, radius = PLAYER_RADIUS) {
  if (![x, z, radius].every(Number.isFinite) || radius <= 0) return false;
  for (let row = index(z - radius); row <= index(z + radius); row++) {
    for (let col = index(x - radius); col <= index(x + radius); col++) {
      if (solid(grid, col, row)) return false;
    }
  }
  return true;
}

function sweepAxis(grid, x, z, delta, alongX, radius) {
  const start = alongX ? x : z;
  if (!delta) return start;
  let end = start + delta;
  const side = alongX ? z : x;
  for (let row = index(side - radius); row <= index(side + radius); row++) {
    for (let col = index(Math.min(start, end) - radius); col <= index(Math.max(start, end) + radius); col++) {
      if (!solid(grid, alongX ? col : row, alongX ? row : col)) continue;
      const low = col * CELL_SIZE - CELL_SIZE / 2 - radius;
      const high = col * CELL_SIZE + CELL_SIZE / 2 + radius;
      if (delta > 0 && start <= low + GAP) end = Math.min(end, low - GAP);
      if (delta < 0 && start >= high - GAP) end = Math.max(end, high + GAP);
    }
  }
  return end;
}

export function moveWithCollisions(grid, position, dx, dz, radius = PLAYER_RADIUS) {
  let {x, z} = position;
  if (![dx, dz].every(Number.isFinite) || !canOccupy(grid, x, z, radius)) return {x, z};
  // Substeps preserve diagonal trajectories; each axis also sweeps its whole segment.
  const limit = Math.max(grid.length, grid[0].length) * CELL_SIZE;
  dx = Math.max(-limit, Math.min(limit, dx));
  dz = Math.max(-limit, Math.min(limit, dz));
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (radius / 2)));
  for (let step = 0; step < steps; step++) {
    x = sweepAxis(grid, x, z, dx / steps, true, radius);
    z = sweepAxis(grid, x, z, dz / steps, false, radius);
  }
  return {x, z};
}

export function boxTouchesWalls(grid, bounds) {
  if (bounds.max.y < 0 || bounds.min.y > 3.6) return false;
  for (let z = index(bounds.min.z); z <= index(bounds.max.z); z++) {
    for (let x = index(bounds.min.x); x <= index(bounds.max.x); x++) {
      if (solid(grid, x, z)) return true;
    }
  }
  return false;
}
