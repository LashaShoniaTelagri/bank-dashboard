"""Trusted-base preview deployment. Never execute PR scripts or log credentials."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.error
import urllib.request

REPO = 'LashaShoniaTelagri/bank-dashboard'
REPO_ID = 1042718467
TARGET = 'izzbuyffxnjxrbxzcreb'
ENVIRONMENT = 'collaboration-preview-backend'
LABEL = 'ale-preview-active'
SHA = re.compile(r'[a-f0-9]{40}\Z')


class Blocked(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Blocked(reason)


def command(args, *, data=None, env=None):
    result = subprocess.run(args, input=data, capture_output=True, timeout=180, env=env)
    require(result.returncode == 0, 'command_failed_no_raw_output')
    require(len(result.stdout) <= 8_388_608, 'response_too_large')
    return result.stdout


def api(path, body=None):
    args = ['gh', 'api', 'repos/' + REPO + path]
    if body is not None:
        args += ['--method', 'POST', '--input', '-']
    return json.loads(command(args, data=None if body is None else json.dumps(body).encode()))


def validate_pr(pr, number, head, base, active):
    require(pr.get('number') == number and pr.get('state') == 'open' and pr.get('draft') is True,
            'open_draft_required')
    require(pr.get('base', {}).get('ref') == 'dev' and pr['base'].get('sha') == base,
            'base_changed_requeue')
    require(pr.get('head', {}).get('sha') == head, 'head_changed_requeue')
    for side in ('head', 'base'):
        repo = pr.get(side, {}).get('repo', {})
        require(repo.get('id') == REPO_ID and repo.get('full_name') == REPO, 'fork_or_wrong_repository')
    require(active == [number] and LABEL in [x.get('name') for x in pr.get('labels', [])],
            'select_exactly_one_active_preview')


def validate_compare(comparison, base):
    require(comparison.get('status') == 'ahead' and comparison.get('merge_base_commit', {}).get('sha') == base,
            'candidate_must_descend_from_dev')
    files = comparison.get('files', [])
    require(1 <= len(files) <= 30, 'candidate_scope_too_large')
    for file in files:
        path = file.get('filename', '')
        require(re.fullmatch(r'[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9_-]+)*', path) is not None and
                all(p not in ('', '.', '..') and not p.startswith('.') for p in path.split('/')) and
                path.startswith(('src/', 'supabase/functions/', 'docs/', 'specs/')) and
                Path(path).suffix in {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css', '.md'} and
                file.get('status') in ('added', 'modified', 'removed'),
                'migration_or_tooling_change_requires_separate_review')


def admit(number, head, base):
    # Label is a persistent reservation, not merely a job-duration mutex.
    issues = api('/issues?state=open&labels=' + LABEL + '&per_page=100')
    require(isinstance(issues, list) and len(issues) < 100, 'active_preview_listing_incomplete')
    active = sorted(x['number'] for x in issues if 'pull_request' in x)
    pr = api('/pulls/' + str(number))
    validate_pr(pr, number, head, base, active)
    validate_compare(api('/compare/' + base + '...' + head), base)
    runs = api('/actions/workflows/pr-checks.yml/runs?event=pull_request&head_sha=' + head + '&per_page=10')
    matches = [r for r in runs.get('workflow_runs', []) if r.get('head_sha') == head and
               r.get('head_repository', {}).get('id') == REPO_ID]
    require(matches and max(matches, key=lambda r: (r['id'], r.get('run_attempt', 1))).get('conclusion') == 'success',
            'latest_pr_checks_must_pass')


def export_source(head, root):
    tree = api('/git/trees/' + head + '?recursive=1')
    require(tree.get('truncated') is False, 'incomplete_source_tree')
    manifest, total = {}, 0
    for entry in tree.get('tree', []):
        name = entry.get('path', '')
        if not name.startswith(('supabase/functions/ale-evaluate/', 'supabase/functions/_shared/')):
            continue
        if entry.get('type') == 'tree':
            continue
        require(entry.get('type') == 'blob' and entry.get('mode') == '100644' and
                re.fullmatch(r'[A-Za-z0-9_./-]+', name) and
                all(p not in ('', '.', '..') and not p.startswith('.') for p in name.split('/')) and
                Path(name).suffix in {'.ts', '.json'} and 0 <= entry.get('size', -1) <= 524288,
                'unsafe_source_entry')
        blob = api('/git/blobs/' + entry['sha'])
        require(blob.get('encoding') == 'base64', 'unexpected_blob_encoding')
        raw = base64.b64decode(blob['content'])
        require(len(raw) == entry['size'] and hashlib.sha1(
            b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == entry['sha'], 'blob_mismatch')
        total += len(raw)
        require(total <= 2_097_152 and len(manifest) < 200, 'source_too_large')
        dest = root / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        manifest[name] = hashlib.sha256(raw).hexdigest()
    require('supabase/functions/ale-evaluate/index.ts' in manifest, 'missing_handler')
    # Never accept config/hooks/import maps from the candidate repository root.
    (root / 'supabase/config.toml').write_text(
        'project_id = "' + TARGET + '"\n[functions.ale-evaluate]\nverify_jwt = false\n')
    return manifest


def function_version():
    functions = json.loads(command(['supabase', 'functions', 'list', '--project-ref', TARGET, '--output', 'json']))
    matches = [f for f in functions if f.get('slug') == 'ale-evaluate']
    require(len(matches) == 1 and matches[0].get('status') == 'ACTIVE' and
            matches[0].get('verify_jwt') is False, 'unexpected_function_state')
    return matches[0]['version']


def main():
    number, head, base = os.environ.get('PREVIEW_PR', ''), os.environ.get('PREVIEW_HEAD', ''), os.environ.get('PREVIEW_BASE', '')
    require(re.fullmatch(r'[1-9][0-9]*', number) and SHA.fullmatch(head) and SHA.fullmatch(base), 'invalid_revision')
    require(os.environ.get('SUPABASE_ACCESS_TOKEN'), 'missing_preview_only_access_token')
    number = int(number)
    admit(number, head, base)
    before = function_version()
    deployment_id = None
    try:
        with tempfile.TemporaryDirectory(prefix='telagri-ale-preview-') as directory:
            root = Path(directory)
            manifest = export_source(head, root)
            admit(number, head, base)
            require(function_version() == before, 'backend_changed_before_deploy')
            deployment = api('/deployments', {'ref': head, 'auto_merge': False, 'required_contexts': [],
                'environment': ENVIRONMENT, 'production_environment': False, 'transient_environment': True,
                'payload': {'pr': number, 'source_commit': head, 'base_commit': base, 'target': TARGET,
                            'function': 'ale-evaluate', 'source_manifest': manifest}})
            deployment_id = deployment['id']
            api(f'/deployments/{deployment_id}/statuses', {'state': 'in_progress', 'auto_inactive': False})
            command(['supabase', 'functions', 'deploy', 'ale-evaluate', '--project-ref', TARGET,
                     '--use-api', '--no-verify-jwt', '--workdir', directory])
            after = function_version()
            require(type(after) is int and after == before + 1, 'unexpected_backend_version_do_not_retry')
            admit(number, head, base)
            request = urllib.request.Request('https://' + TARGET + '.supabase.co/functions/v1/ale-evaluate',
                data=b'{}', headers={'Content-Type': 'application/json'}, method='POST')
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    status = response.status
            except urllib.error.HTTPError as error:
                status = error.code
                error.close()
            require(status == 401, 'unauthenticated_request_not_rejected')
            api(f'/deployments/{deployment_id}/statuses', {'state': 'success', 'auto_inactive': True,
                'description': f'ale-evaluate v{after}; auth rejection passed; human testing pending'})
            print(json.dumps({'backend_deployed': True, 'pr': number, 'commit': head,
                              'function_version': after, 'deployment_id': deployment_id,
                              'ready_for_human_testing': False,
                              'remaining': 'matching_frontend_and_protected_reviewer_link'}))
    except Exception:
        if deployment_id is not None:
            try:
                api(f'/deployments/{deployment_id}/statuses', {'state': 'failure', 'auto_inactive': False,
                    'description': 'Preview failed/uncertain. Operator inspection required; no automatic rollback.'})
            except Exception:
                pass
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # No provider response, exception traceback or credential values in logs.
        print(json.dumps({'ok': False, 'error': str(error) if isinstance(error, Blocked) else 'preview_failed_or_uncertain'}))
        raise SystemExit(1)
