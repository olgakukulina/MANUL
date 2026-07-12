users_db = {
    'admin': {
        'password': 'admin123',
        'role': 'admin',
        'name': 'Администратор',
        'email': 'admin@example.com'
    },
    'user': {
        'password': 'user123',
        'role': 'user',
        'name': 'Пользователь',
        'email': 'user@example.com'
    }
}


def authenticate(login, password):
    """Проверка учетных данных пользователя"""
    if login in users_db and users_db[login]['password'] == password:
        return {
            'success': True,
            'user': {
                'login': login,
                'role': users_db[login]['role'],
                'name': users_db[login]['name']
            }
        }
    return None


def register_user(login, password, name='', email=''):
    """Регистрация нового пользователя"""
    if not login or not password:
        return {'success': False, 'error': 'Логин и пароль обязательны'}

    users_db[login] = {
        'password': password,
        'role': 'admin' if login == 'admin' else 'user',
        'name': name or login,
        'email': email or ''
    }

    return {
        'success': True,
        'message': 'Регистрация успешна!',
        'user': {
            'login': login,
            'role': users_db[login]['role'],
            'name': users_db[login]['name']
        }
    }