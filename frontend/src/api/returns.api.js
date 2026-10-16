import { createResource, getResource } from './resources.api';

export const returnsQueryKey = (siteId) => ['site-data', siteId, 'returns'];
export const getReturns = (siteId) => getResource(siteId, 'returns');
export const createReturn = (siteId, payload) => createResource(siteId, 'returns', payload);
