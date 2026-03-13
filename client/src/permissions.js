// Simple permission helper used by client pages
// Pages are identified by keys such as: 'manufacturing', 'rawmaterials', 'distributor', 'retailer', 'addmed', 'supply', 'track'
const editPermissions = {
  // Only ADMIN and MAN can edit manufacturing
  manufacturing: ['ADMIN', 'MAN'],
  // Raw materials: only ADMIN and SUP can edit
  rawmaterials: ['ADMIN', 'SUP'],
  // Distributor inventory: ADMIN and DIS
  distributor: ['ADMIN', 'DIS'],
  // Retailer inventory: ADMIN and RET
  retailer: ['ADMIN', 'RET'],
  // AddMed, Supply, Track are primarily informational for MAN role (MAN can operate supply flow via blockchain UI)
  addmed: ['ADMIN'],
  supply: ['ADMIN'],
  track: ['ADMIN']
};

export const canEdit = (pageKey, role) => {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  const allowed = editPermissions[pageKey];
  if (!allowed) return false; // default deny
  return allowed.includes(role);
};

export const canView = (_pageKey, _role) => {
  // In this app all authenticated users can view all pages
  return true;
};

export default { canEdit, canView };
