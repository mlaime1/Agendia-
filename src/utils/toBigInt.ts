export const toBigInt = (id: string | number | bigint) => {
  if (typeof id === 'bigint') return id;
  const n = typeof id === 'number' ? id : Number(id);
  if (Number.isNaN(n)) throw new Error('Invalid id');
  return BigInt(n);
};

export default toBigInt;
