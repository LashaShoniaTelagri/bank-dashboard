import copy
import unittest
from unittest.mock import patch, MagicMock
import deploy
from deploy import Blocked, REPO, REPO_ID, LABEL, validate_pr, validate_compare

BASE, HEAD = 'a' * 40, 'b' * 40


class AdmissionTests(unittest.TestCase):
    def pr(self):
        repo = {'id': REPO_ID, 'full_name': REPO}
        return {'number': 42, 'state': 'open', 'draft': True, 'labels': [{'name': LABEL}],
                'head': {'sha': HEAD, 'repo': repo}, 'base': {'sha': BASE, 'ref': 'dev', 'repo': repo}}

    def test_one_matching_draft(self):
        validate_pr(self.pr(), 42, HEAD, BASE, [42])

    def test_no_or_multiple_reservations(self):
        for active in ([], [43], [42, 43]):
            with self.assertRaises(Blocked):
                validate_pr(self.pr(), 42, HEAD, BASE, active)

    def test_drift_forks_main_and_non_drafts_rejected(self):
        for side, field, value in [('head', 'sha', BASE), ('base', 'sha', HEAD), ('base', 'ref', 'main'),
                                   ('head', 'repo', {'id': 1, 'full_name': REPO})]:
            pr = copy.deepcopy(self.pr())
            pr[side][field] = value
            with self.assertRaises(Blocked):
                validate_pr(pr, 42, HEAD, BASE, [42])
        for change in ({'draft': False}, {'state': 'closed'}, {'labels': []}):
            with self.assertRaises(Blocked):
                validate_pr({**self.pr(), **change}, 42, HEAD, BASE, [42])

    def comparison(self, path):
        return {'status': 'ahead', 'merge_base_commit': {'sha': BASE},
                'files': [{'filename': path, 'status': 'modified'}]}

    def test_source_allowed(self):
        validate_compare(self.comparison('supabase/functions/ale-evaluate/index.ts'), BASE)

    def test_migrations_workflows_packages_and_escape_rejected(self):
        for path in ['supabase/migrations/20261001.sql', '.github/workflows/ci.yml',
                     'package.json', 'scripts/preview/deploy.py', 'src/../package.json', 'src/.env', 'src/file.sh']:
            with self.subTest(path=path), self.assertRaises(Blocked):
                validate_compare(self.comparison(path), BASE)

    def test_diverged_or_truncated_comparison_rejected(self):
        c = self.comparison('src/test.ts')
        for change in ({'status': 'diverged'}, {'merge_base_commit': {'sha': HEAD}}, {'files': []},
                       {'files': c['files'] * 300}):
            with self.assertRaises(Blocked):
                validate_compare({**c, **change}, BASE)


class DeploymentTests(unittest.TestCase):
    def run_candidate(self, versions=(21, 21, 22), http=401, command_error=False, drift=False):
        calls = []
        def api(path, body=None):
            calls.append((path, body))
            return {'id': 9} if path == '/deployments' else {}
        response = MagicMock()
        response.__enter__.return_value.status = http
        with patch.dict('os.environ', {'PREVIEW_PR': '42', 'PREVIEW_HEAD': HEAD, 'PREVIEW_BASE': BASE,
                                      'SUPABASE_ACCESS_TOKEN': 'synthetic-preview-token'}), \
             patch.object(deploy, 'admit', side_effect=[None, None, Blocked('head_changed_requeue') if drift else None]), \
             patch.object(deploy, 'function_version', side_effect=versions), \
             patch.object(deploy, 'export_source', return_value={'handler': 'digest'}), \
             patch.object(deploy, 'api', side_effect=api), \
             patch.object(deploy, 'command', side_effect=Blocked('command_failed_no_raw_output') if command_error else None) as cmd, \
             patch.object(deploy.urllib.request, 'urlopen', return_value=response), \
             patch('builtins.print'):
            error = None
            try:
                deploy.main()
            except Blocked as caught:
                error = str(caught)
        return calls, cmd.call_args_list, error

    def test_deploys_only_fixed_preview_function_and_records_revision(self):
        calls, commands, error = self.run_candidate()
        self.assertIsNone(error)
        self.assertEqual(len(commands), 1)
        args = commands[0].args[0]
        self.assertEqual(args[:6], ['supabase', 'functions', 'deploy', 'ale-evaluate', '--project-ref', deploy.TARGET])
        self.assertIn('--use-api', args)
        self.assertEqual(calls[0][1]['ref'], HEAD)
        self.assertEqual(calls[0][1]['payload']['source_commit'], HEAD)
        self.assertFalse(calls[0][1]['production_environment'])
        self.assertEqual(calls[-1][1]['state'], 'success')

    def test_uncertain_deployment_never_retries_or_rolls_back(self):
        calls, commands, error = self.run_candidate(command_error=True)
        self.assertIsNotNone(error)
        self.assertEqual(len(commands), 1)
        self.assertEqual(calls[-1][1]['state'], 'failure')

    def test_wrong_version_auth_or_revision_never_reports_success(self):
        for kwargs in [{'versions': (21, 21, 23)}, {'http': 200}, {'drift': True}]:
            calls, commands, error = self.run_candidate(**kwargs)
            self.assertIsNotNone(error)
            self.assertEqual(len(commands), 1)
            self.assertEqual(calls[-1][1]['state'], 'failure')

    def test_backend_drift_before_write_blocks_deployment(self):
        calls, commands, error = self.run_candidate(versions=(21, 22))
        self.assertEqual(error, 'backend_changed_before_deploy')
        self.assertEqual(commands, [])
        self.assertEqual(calls, [])

    def test_missing_preview_credential_blocks_without_provider_calls(self):
        with patch.dict('os.environ', {'PREVIEW_PR': '42', 'PREVIEW_HEAD': HEAD, 'PREVIEW_BASE': BASE,
                                      'SUPABASE_ACCESS_TOKEN': ''}), patch.object(deploy, 'api') as api:
            with self.assertRaisesRegex(Blocked, 'missing_preview_only_access_token'):
                deploy.main()
            api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
