import { init } from './app/admin/supabase-admin.js';

((w) => {
    w.undangan = init();
})(window);