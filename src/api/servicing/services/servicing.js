'use strict';

/**
 * servicing service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::servicing.servicing');
