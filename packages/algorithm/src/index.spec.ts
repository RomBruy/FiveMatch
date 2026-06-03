import { getAlgorithmPackageStatus } from './index';

describe('getAlgorithmPackageStatus', () => {
  it('confirms the algorithm package test runner is wired', () => {
    expect(getAlgorithmPackageStatus()).toEqual({
      key: 'team-generator',
      status: 'ready',
    });
  });
});
