/// Module: wit_repository::repository
/// Description: This module implements the core logic for the Withub decentralized repository system.
/// It manages repository state, ownership, collaborators, and the reference to the latest commit (head).
module wit_repository::repository {
    use sui::event;

    /// Struct representing a decentralized repository.
    /// It holds the metadata and the current state of the repository.
    public struct Repository has key, store {
        id: UID,
        /// The address of the repository owner.
        owner: address,
        /// List of collaborator addresses who have write access.
        collaborators: vector<address>,
        /// The Walrus Blob ID of the current head commit (optional).
        head_commit: Option<vector<u8>>,
        /// The Walrus Blob ID of the current head manifest (optional, for quick access).
        head_manifest: Option<vector<u8>>,
        /// The Walrus Blob ID of the current head quilt (optional, for quick access).
        head_quilt: Option<vector<u8>>,
        /// The current version of the repository, incremented on every update.
        /// Used for optimistic concurrency control.
        version: u64,
        /// The Seal Policy ID used for encryption (optional, for private repositories).
        seal_policy_id: Option<vector<u8>>,
        /// The name of the repository.
        name: vector<u8>,
        /// A brief description of the repository.
        description: vector<u8>,
    }

    /// Event emitted when the repository head is updated.
    /// Indexers can listen to this event to track repository updates.
    public struct HeadUpdatedEvent has copy, drop {
        /// The ID of the repository that was updated.
        repo_id: address,
        /// The new head commit Blob ID.
        new_commit: vector<u8>,
        /// The new head manifest Blob ID.
        new_manifest: vector<u8>,
        /// The new head quilt Blob ID.
        new_quilt: vector<u8>,
        /// The new version of the repository.
        version: u64,
        /// The parent commit Blob ID (for history tracking).
        parent: Option<vector<u8>>,
    }

    // === Errors ===
    const ENotAuthorized: u64 = 1;
    const EVersionMismatch: u64 = 2;
    const EParentMismatch: u64 = 3;

    /// Creates a new repository and shares it as a shared object.
    ///
    /// # Arguments
    /// * `name` - The name of the repository.
    /// * `description` - A brief description.
    /// * `seal_policy_id` - Optional Seal Policy ID for private repositories.
    /// * `ctx` - The transaction context.
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
        // Share the object so it can be accessed by collaborators and the public.
        transfer::public_share_object(repo);
    }

    /// Adds a collaborator to the repository.
    /// Only the owner or an existing collaborator can add new collaborators.
    ///
    /// # Arguments
    /// * `repo` - The mutable reference to the repository.
    /// * `addr` - The address of the collaborator to add.
    /// * `ctx` - The transaction context.
    public fun add_collaborator(repo: &mut Repository, addr: address, ctx: &TxContext) {
        assert!(is_owner_or_collaborator(repo, ctx.sender()), ENotAuthorized);
        if (!contains(&repo.collaborators, addr)) {
            repo.collaborators.push_back(addr);
        }
    }

    /// Removes a collaborator from the repository.
    /// Only the owner or an existing collaborator can remove collaborators.
    ///
    /// # Arguments
    /// * `repo` - The mutable reference to the repository.
    /// * `addr` - The address of the collaborator to remove.
    /// * `ctx` - The transaction context.
    public fun remove_collaborator(repo: &mut Repository, addr: address, ctx: &TxContext) {
        assert!(is_owner_or_collaborator(repo, ctx.sender()), ENotAuthorized);
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

    /// Updates the head of the repository to point to a new commit.
    /// This function enforces optimistic concurrency control using `expected_version`.
    ///
    /// # Arguments
    /// * `repo` - The mutable reference to the repository.
    /// * `new_commit` - The Walrus Blob ID of the new commit object.
    /// * `new_manifest` - The Walrus Blob ID of the new manifest.
    /// * `new_quilt` - The Walrus Blob ID of the new quilt.
    /// * `expected_version` - The version the caller expects the repository to be at.
    /// * `parent_commit` - The commit ID that the new commit is based on.
    /// * `ctx` - The transaction context.
    public fun update_head(
        repo: &mut Repository,
        new_commit: vector<u8>,
        new_manifest: vector<u8>,
        new_quilt: vector<u8>,
        expected_version: u64,
        parent_commit: Option<vector<u8>>,
        ctx: &TxContext,
    ) {
        // 1. Check authorization
        assert!(is_owner_or_collaborator(repo, ctx.sender()), ENotAuthorized);
        
        // 2. Check concurrency (Optimistic Locking)
        assert!(repo.version == expected_version, EVersionMismatch);
        
        // 3. Check consistency (Parent of new commit must match current head)
        assert!(option_bytes_eq(&repo.head_commit, &parent_commit), EParentMismatch);

        // 4. Update state
        repo.head_commit = option::some(new_commit);
        repo.head_manifest = option::some(new_manifest);
        repo.head_quilt = option::some(new_quilt);
        repo.version = repo.version + 1;

        // 5. Emit event
        event::emit(HeadUpdatedEvent {
            repo_id: object::uid_to_address(&repo.id),
            new_commit,
            new_manifest,
            new_quilt,
            version: repo.version,
            parent: parent_commit,
        });
    }

    /// Updates the Seal Policy ID for the repository.
    /// This allows changing the encryption policy (e.g., for key rotation or access control updates).
    /// Only the owner or an existing collaborator can update the policy.
    ///
    /// # Arguments
    /// * `repo` - The mutable reference to the repository.
    /// * `new_policy_id` - The new Seal Policy ID (optional).
    /// * `ctx` - The transaction context.
    public fun set_seal_policy(
        repo: &mut Repository,
        new_policy_id: Option<vector<u8>>,
        ctx: &TxContext,
    ) {
        assert!(is_owner_or_collaborator(repo, ctx.sender()), ENotAuthorized);
        repo.seal_policy_id = new_policy_id;
    }

    // === Internal Helper Functions ===

    /// Checks if the given address is the owner or a collaborator.
    fun is_owner_or_collaborator(repo: &Repository, addr: address): bool {
        if (addr == repo.owner) return true;
        contains(&repo.collaborators, addr)
    }

    /// Checks if a vector contains a specific address.
    fun contains(v: &vector<address>, addr: address): bool {
        let len = v.length();
        let mut i = 0;
        while (i < len) {
            if (v[i] == addr) return true;
            i = i + 1;
        };
        false
    }

    /// Helper to compare two Option<vector<u8>> for equality.
    fun option_bytes_eq(a: &Option<vector<u8>>, b: &Option<vector<u8>>): bool {
        if (a.is_some() && b.is_some()) {
            let va = a.borrow();
            let vb = b.borrow();
            return bytes_eq(va, vb)
        };
        a.is_none() && b.is_none()
    }

    /// Helper to compare two vector<u8> for equality.
    fun bytes_eq(a: &vector<u8>, b: &vector<u8>): bool {
        let lena = a.length();
        let lenb = b.length();
        if (lena != lenb) return false;
        let mut i = 0;
        while (i < lena) {
            if (a[i] != b[i]) return false;
            i = i + 1;
        };
        true
    }
}
