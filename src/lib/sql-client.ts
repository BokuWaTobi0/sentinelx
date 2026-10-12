import type { QueryResultRow } from 'pg';
// Both node-postgres and the embedded PostgreSQL test adapter satisfy this contract.
export interface SqlClient {
 query<Row extends QueryResultRow = QueryResultRow>(text:string,values?:unknown[]):Promise<{rows:Row[]}>;
}
