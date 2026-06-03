export type AlgorithmPackageStatus = {
  key: 'team-generator';
  status: 'ready';
};

export function getAlgorithmPackageStatus(): AlgorithmPackageStatus {
  return {
    key: 'team-generator',
    status: 'ready',
  };
}
