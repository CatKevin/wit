module wit_repository::repository {
    use sui::event;

    public struct Repository has key {
        id: UID,
        owner: address,
        collaborators: vector<address>,
        head_commit: Option<vector<u8>>,
        head_manifest: Option<vector<u8>>,
        head_quilt: Option<vector<u8>>,
        version: u64,
        seal_policy_id: Option<vector<u8>>,
        name: vector<u8>,
        description: vector<u8>,
    }

    public struct HeadUpdatedEvent has copy, drop {
        repo_id: address,
        new_commit: vector<u8>,
        new_manifest: vector<u8>,
        new_quilt: vector<u8>,
        version: u64,
        parent: Option<vector<u8>>,
    }

    public fun create_repo(
        name: vector<u8>,
        description: vector<u8>,
        seal_policy_id: Option<vector<u8>>,
        ctx: &mut TxContext,
    ) {
        let repo = Repository {
            id: object::new(ctx),
            owner: ctx.sender(),
            collaborators: vector[],
            head_commit: option::none(),
            head_manifest: option::none(),
            head_quilt: option::none(),
            version: 0,
            seal_policy_id,
            name,
            description,
        };
        transfer::share_object(repo);
    }

    public fun add_collaborator(repo: &mut Repository, addr: address, ctx: &TxContext) {
        assert!(is_owner_or_collaborator(repo, ctx.sender()), 1);
        if (!contains(&repo.collaborators, addr)) {
            repo.collaborators.push_back(addr);
        }
    }

    public fun remove_collaborator(repo: &mut Repository, addr: address, ctx: &TxContext) {
        assert!(is_owner_or_collaborator(repo, ctx.sender()), 1);
        let len = repo.collaborators.length();
        let mut i = 0;
        while (i < len) {
            if (repo.collaborators[i] == addr) {
                repo.collaborators.swap_remove(i);
                break
            };
            i = i + 1;
        }
    }

    public fun update_head(
        repo: &mut Repository,
        new_commit: vector<u8>,
        new_manifest: vector<u8>,
        new_quilt: vector<u8>,
        expected_version: u64,
        parent_commit: Option<vector<u8>>,
        ctx: &TxContext,
    ) {
        assert!(is_owner_or_collaborator(repo, ctx.sender()), 1);
        assert!(repo.version == expected_version, 2);
        assert!(option_bytes_eq(&repo.head_commit, &parent_commit), 3);

        repo.head_commit = option::some(new_commit);
        repo.head_manifest = option::some(new_manifest);
        repo.head_quilt = option::some(new_quilt);
        repo.version = repo.version + 1;

        event::emit(HeadUpdatedEvent {
            repo_id: object::uid_to_address(&repo.id),
            new_commit,
            new_manifest,
            new_quilt,
            version: repo.version,
            parent: parent_commit,
        });
    }

    fun is_owner_or_collaborator(repo: &Repository, addr: address): bool {
        if (addr == repo.owner) return true;
        contains(&repo.collaborators, addr)
    }

    fun contains(v: &vector<address>, addr: address): bool {
        let len = vector::length(v);
        let mut i = 0;
        while (i < len) {
            if (*vector::borrow(v, i) == addr) return true;
            i = i + 1;
        };
        false
    }

    fun option_bytes_eq(a: &Option<vector<u8>>, b: &Option<vector<u8>>): bool {
        if (option::is_some(a) && option::is_some(b)) {
            let va = option::borrow(a);
            let vb = option::borrow(b);
            return bytes_eq(va, vb)
        };
        option::is_none(a) && option::is_none(b)
    }

    fun bytes_eq(a: &vector<u8>, b: &vector<u8>): bool {
        let lena = vector::length(a);
        let lenb = vector::length(b);
        if (lena != lenb) return false;
        let mut i = 0;
        while (i < lena) {
            if (*vector::borrow(a, i) != *vector::borrow(b, i)) return false;
            i = i + 1;
        };
        true
    }
}
