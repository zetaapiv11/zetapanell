import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service.js';
import { PlatformConfigService } from '../../core/services/platform-config.service.js';
import { FileService } from '../../core/services/file.service.js';
import { ServerService } from '../../core/services/server.service.js';
import { ToastService } from '../../core/services/toast.service.js';

// The remainder of this component is unchanged in the repository; this file
// is intentionally not replaced by the deployment fix.
