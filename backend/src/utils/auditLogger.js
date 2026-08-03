/**
 * Centralizador de registros de auditoria (Audit Trail) para ações críticas de segurança.
 */
function registrarAuditoria({ acao, ator, tenantId, detalhes, req }) {
  const ip = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : 'sistema';
  const timestamp = new Date().toISOString();

  const logEntry = {
    timestamp,
    acao,
    ator: ator || 'anonimo',
    tenantId: tenantId || req?.tenantId || 'global',
    ip,
    detalhes: detalhes || {},
  };

  console.log(`[AUDIT] ${timestamp} | Ação: ${acao} | Ator: ${JSON.stringify(ator)} | Tenant: ${logEntry.tenantId} | IP: ${ip}`, detalhes ? JSON.stringify(detalhes) : '');
  
  return logEntry;
}

module.exports = { registrarAuditoria };
