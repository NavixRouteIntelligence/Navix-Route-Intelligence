import { SetMetadata } from '@nestjs/common';

import type { PublicApiScope } from '../domain/public-api';

export const API_SCOPES_KEY = 'navix.public-api.scopes';
export const ApiScopes = (...scopes: PublicApiScope[]): MethodDecorator =>
  SetMetadata(API_SCOPES_KEY, scopes);
