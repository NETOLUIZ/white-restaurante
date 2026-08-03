// Chaves de feature conhecidas do sistema — únicas aceitas em TenantFeature.
// Compartilhado entre o provisionamento de tenant (script + super admin) e o
// controller que liga/desliga features.
const CHAVES_FEATURE = ['empresa', 'entregador', 'mesas', 'cupom', 'marmita'];

module.exports = { CHAVES_FEATURE };
