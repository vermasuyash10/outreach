import { getAllProspects } from '@/lib/db/repository';

export const dynamic = 'force-dynamic';

function badge(qualified: boolean) {
  return qualified
    ? 'bg-emerald-900 text-emerald-300'
    : 'bg-slate-800 text-slate-400';
}

export default function HomePage() {
  const prospects = getAllProspects();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Outreach Prospect Qualifier</h1>
      <p className="mt-1 text-sm text-slate-400">
        Enrichment + scoring results from the most recent <code>npm run qualify</code> runs.
        Run <code>npm run qualify -- --csv sample-domains.csv --keywords "..."</code> to populate
        this list.
      </p>

      <div className="mt-8 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-2">Domain</th>
              <th className="px-4 py-2">Fit Score</th>
              <th className="px-4 py-2">Qualified</th>
              <th className="px-4 py-2">Relevance</th>
              <th className="px-4 py-2">Guest Post Page</th>
              <th className="px-4 py-2">Emails</th>
              <th className="px-4 py-2">Top Reason</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => {
              const reasons: string[] = JSON.parse(p.qualification_reasons);
              const emails: string[] = JSON.parse(p.discovered_emails);
              return (
                <tr key={p.id} className="border-t border-slate-800">
                  <td className="px-4 py-2 font-medium">{p.domain}</td>
                  <td className="px-4 py-2">{p.fit_score ?? '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${badge(!!p.is_qualified)}`}>
                      {p.is_qualified ? 'Qualified' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-2">{p.relevance_score ?? '-'}</td>
                  <td className="px-4 py-2">{p.has_guest_post_page ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">{emails.length}</td>
                  <td className="px-4 py-2 text-slate-400">{reasons[0] ?? ''}</td>
                </tr>
              );
            })}
            {prospects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No prospects yet. Run the qualify script to enrich some domains.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
