export type SurveyStationInput = {
  measuredDepth: number;
  inclination: number;
  azimuth: number;
  tvd?: number | null;
  northing?: number | null;
  easting?: number | null;
};

export type ProjectedSurveyStation = SurveyStationInput & {
  tvd: number;
  northing: number;
  easting: number;
  verticalSection: number;
  doglegSeverity: number | null;
  buildRate: number | null;
  turnRate: number | null;
  closureDistance: number;
  closureAzimuth: number;
  courseLength: number | null;
  verticalSectionAzimuth: number;
};

export type SurveyProjectionOptions = {
  verticalSectionAzimuth?: number;
};

const degreesToRadians = (value: number) => (value * Math.PI) / 180;
const radiansToDegrees = (value: number) => (value * 180) / Math.PI;

const normalizeAzimuth = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const normalizeDeltaAngle = (value: number) => {
  let normalized = value;

  while (normalized > 180) {
    normalized -= 360;
  }

  while (normalized < -180) {
    normalized += 360;
  }

  return normalized;
};

const roundSurveyValue = (value: number, decimalPlaces = 4) => {
  const multiplier = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const calculateClosureAzimuth = (northing: number, easting: number) => {
  if (northing === 0 && easting === 0) {
    return 0;
  }

  return normalizeAzimuth(radiansToDegrees(Math.atan2(easting, northing)));
};

export const projectSurveyStations = (
  stations: SurveyStationInput[],
  options: SurveyProjectionOptions = {},
): ProjectedSurveyStation[] => {
  const sortedStations = [...stations].sort(
    (left, right) => left.measuredDepth - right.measuredDepth,
  );

  if (sortedStations.length === 0) {
    return [];
  }

  const verticalSectionAzimuth = normalizeAzimuth(
    options.verticalSectionAzimuth ?? sortedStations[0]?.azimuth ?? 0,
  );
  const verticalSectionAzimuthRadians = degreesToRadians(verticalSectionAzimuth);
  const projectedStations: ProjectedSurveyStation[] = [];

  for (const [index, station] of sortedStations.entries()) {
    if (index === 0) {
      const tvd = station.tvd ?? 0;
      const northing = station.northing ?? 0;
      const easting = station.easting ?? 0;
      const closureDistance = Math.hypot(northing, easting);

      projectedStations.push({
        ...station,
        tvd: roundSurveyValue(tvd),
        northing: roundSurveyValue(northing),
        easting: roundSurveyValue(easting),
        verticalSection: roundSurveyValue(
          northing * Math.cos(verticalSectionAzimuthRadians) +
            easting * Math.sin(verticalSectionAzimuthRadians),
        ),
        doglegSeverity: null,
        buildRate: null,
        turnRate: null,
        closureDistance: roundSurveyValue(closureDistance),
        closureAzimuth: roundSurveyValue(calculateClosureAzimuth(northing, easting)),
        courseLength: null,
        verticalSectionAzimuth,
      });
      continue;
    }

    const previousInput = sortedStations[index - 1];
    const previousProjected = projectedStations[index - 1];

    if (!previousInput || !previousProjected) {
      continue;
    }

    const courseLength = station.measuredDepth - previousInput.measuredDepth;

    if (courseLength <= 0) {
      projectedStations.push({
        ...station,
        tvd: previousProjected.tvd,
        northing: previousProjected.northing,
        easting: previousProjected.easting,
        verticalSection: previousProjected.verticalSection,
        doglegSeverity: 0,
        buildRate: 0,
        turnRate: 0,
        closureDistance: previousProjected.closureDistance,
        closureAzimuth: previousProjected.closureAzimuth,
        courseLength: 0,
        verticalSectionAzimuth,
      });
      continue;
    }

    const previousInclination = degreesToRadians(previousInput.inclination);
    const currentInclination = degreesToRadians(station.inclination);
    const previousAzimuth = degreesToRadians(previousInput.azimuth);
    const currentAzimuth = degreesToRadians(station.azimuth);
    const doglegRadians = Math.acos(
      clamp(
        Math.cos(previousInclination) * Math.cos(currentInclination) +
          Math.sin(previousInclination) *
            Math.sin(currentInclination) *
            Math.cos(currentAzimuth - previousAzimuth),
        -1,
        1,
      ),
    );
    const ratioFactor =
      Math.abs(doglegRadians) < 1e-12
        ? 1
        : (2 / doglegRadians) * Math.tan(doglegRadians / 2);
    const deltaTvd =
      (courseLength / 2) *
      (Math.cos(previousInclination) + Math.cos(currentInclination)) *
      ratioFactor;
    const deltaNorthing =
      (courseLength / 2) *
      (Math.sin(previousInclination) * Math.cos(previousAzimuth) +
        Math.sin(currentInclination) * Math.cos(currentAzimuth)) *
      ratioFactor;
    const deltaEasting =
      (courseLength / 2) *
      (Math.sin(previousInclination) * Math.sin(previousAzimuth) +
        Math.sin(currentInclination) * Math.sin(currentAzimuth)) *
      ratioFactor;
    const tvd = previousProjected.tvd + deltaTvd;
    const northing = previousProjected.northing + deltaNorthing;
    const easting = previousProjected.easting + deltaEasting;
    const verticalSection =
      northing * Math.cos(verticalSectionAzimuthRadians) +
      easting * Math.sin(verticalSectionAzimuthRadians);
    const closureDistance = Math.hypot(northing, easting);
    const doglegSeverity = (radiansToDegrees(doglegRadians) * 100) / courseLength;
    const buildRate =
      ((station.inclination - previousInput.inclination) * 100) / courseLength;
    const turnRate =
      (normalizeDeltaAngle(station.azimuth - previousInput.azimuth) * 100) /
      courseLength;

    projectedStations.push({
      ...station,
      tvd: roundSurveyValue(tvd),
      northing: roundSurveyValue(northing),
      easting: roundSurveyValue(easting),
      verticalSection: roundSurveyValue(verticalSection),
      doglegSeverity: roundSurveyValue(doglegSeverity),
      buildRate: roundSurveyValue(buildRate),
      turnRate: roundSurveyValue(turnRate),
      closureDistance: roundSurveyValue(closureDistance),
      closureAzimuth: roundSurveyValue(calculateClosureAzimuth(northing, easting)),
      courseLength: roundSurveyValue(courseLength),
      verticalSectionAzimuth,
    });
  }

  return projectedStations;
};
